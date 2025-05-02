import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  AppState,
  GestureResponderEvent
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Add declaration for global event handler if it doesn't exist in this file
declare global {
  var updateNotificationBadges: ((count?: number) => void) | undefined;
}

// Types for our data
type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    full_name: string;
    interests?: string[];
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

type Interest = string;

export default function Home() {
  const { session, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingFollowRequests, setPendingFollowRequests] = useState(0);
  const [notifications, setNotifications] = useState(0);
  const [connectingUsers, setConnectingUsers] = useState<string[]>([]);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Fetch posts, interests, and other data
  useEffect(() => {
    fetchData();
  }, []);

  // Filter posts when selected interests change
  useEffect(() => {
    if (selectedInterests.length === 0) {
      setFilteredPosts(posts);
    } else {
      // Filter posts where any of the post author's interests match the selected interests
      const filtered = posts.filter(post => {
        // Check if the post's author has any of the selected interests
        return post.user.interests && post.user.interests.some(interest => 
          selectedInterests.includes(interest)
        );
      });
      
      setFilteredPosts(filtered);
      
      // If no posts match the selected interests, show a message
      if (filtered.length === 0 && posts.length > 0) {
        console.log('No posts found for the selected interests');
      }
    }
  }, [selectedInterests, posts]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. First, fetch basic post data
      let processedPosts: Post[] = [];
      
      try {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (postsError) {
          console.error('Posts error:', postsError);
        } else if (postsData && postsData.length > 0) {
          // 2. Process each post to add user, likes, and comments data
          for (const post of postsData) {
            try {
              // Get user profile with interests
              const { data: userData } = await supabase
                .from('profiles')
                .select('username, full_name, interests')
                .eq('id', post.user_id)
                .single();
              
              // Get likes count
              const { count: likesCount } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
              
              // Get comments count
              const { count: commentsCount } = await supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
              
              // Check if user liked the post
              const { data: userLike } = await supabase
                .from('likes')
                .select('*')
                .eq('post_id', post.id)
                .eq('user_id', session?.user.id)
                .single();
              
              processedPosts.push({
                id: post.id,
                user_id: post.user_id,
                content: post.content,
                created_at: post.created_at,
                user: {
                  username: userData?.username || 'Unknown',
                  full_name: userData?.full_name || 'Unknown User',
                  interests: userData?.interests || []
                },
                likes_count: likesCount || 0,
                comments_count: commentsCount || 0,
                is_liked: !!userLike
              });
            } catch (err) {
              // Still add post with default values if processing failed
              processedPosts.push({
                ...post,
                user: {
                  username: 'Unknown',
                  full_name: 'Unknown User',
                  interests: []
                },
                likes_count: 0,
                comments_count: 0,
                is_liked: false
              });
            }
          }
        }
      } catch (err) {
        console.error('Error in posts query:', err);
      }
      
      setPosts(processedPosts);
      setFilteredPosts(processedPosts);
      
      // 3. Fetch user interests
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('interests')
          .eq('id', session?.user.id)
          .single();
        
        if (profileData) {
          setInterests(profileData.interests || []);
        }
      } catch (err) {
        console.error('Error fetching interests:', err);
      }
      
      // 4. Fetch pending follow requests
      try {
        const { data: friendRequests } = await supabase
          .from('friends')
          .select('id')
          .eq('receiver_id', session?.user.id)
          .eq('status', 'pending');
        
        setPendingFollowRequests(friendRequests?.length || 0);
      } catch (err) {
        console.error('Error fetching friend requests:', err);
      }
      
      // 5. Fetch unread notifications
      try {
        const { data: notifs } = await supabase
          .from('notifications')
          .select('id')
          .eq('recipient_id', session?.user.id)
          .eq('read', false);
        
        setNotifications(notifs?.length || 0);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLike = async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const isLiked = post.is_liked;
      
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session?.user.id);
          
        if (error) throw error;
        
        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_liked: false, likes_count: p.likes_count - 1 } 
            : p
        ));
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: session?.user.id, is_like: true });
          
        if (error) throw error;
        
        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_liked: true, likes_count: p.likes_count + 1 } 
            : p
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleComment = (postId: string) => {
    // Navigate to comments screen
    router.push({
      pathname: '/comments/[id]',
      params: { id: postId }
    });
  };

  const handleShare = (postId: string) => {
    // Implement sharing functionality
    Alert.alert('Share', 'Sharing functionality will be implemented soon.');
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/search',
        params: { q: searchQuery.trim() }
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleConnect = async (userId: string) => {
    try {
      // Don't allow connecting to yourself
      if (userId === session?.user.id) {
        Alert.alert('Info', 'You cannot follow yourself');
        return;
      }

      // Set the user as "connecting" to show loading state
      setConnectingUsers([...connectingUsers, userId]);

      // Check if a follow relationship already exists
      const { data: existingFollow, error: checkError } = await supabase
        .from('followers')
        .select('*')
        .eq('follower_id', session?.user.id)
        .eq('following_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is the error code for "no rows returned"
        throw checkError;
      }

      // Check if the other person follows you
      const { data: otherFollow, error: otherCheckError } = await supabase
        .from('followers')
        .select('*')
        .eq('follower_id', userId)
        .eq('following_id', session?.user.id)
        .single();

      if (otherCheckError && otherCheckError.code !== 'PGRST116') {
        throw otherCheckError;
      }

      if (existingFollow) {
        // You already follow this user
        if (existingFollow.status === 'accepted') {
          Alert.alert('Already Following', 'You are already following this user');
        } else if (existingFollow.status === 'pending') {
          Alert.alert('Request Pending', 'Your follow request is pending approval');
        } else if (existingFollow.status === 'rejected') {
          // Allow to send a request again
          const { error: updateError } = await supabase
            .from('followers')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', existingFollow.id);
            
          if (updateError) throw updateError;
          
          Alert.alert('Success', 'Follow request sent');
        }
      } else if (otherFollow && otherFollow.status === 'pending') {
        // They requested to follow you, offer to accept
        Alert.alert(
          'Follow Request', 
          'This user has sent you a follow request', 
          [
            { text: 'Cancel' },
            { 
              text: 'Accept Request', 
              onPress: async () => {
                try {
                  const { error: updateError } = await supabase
                    .from('followers')
                    .update({ status: 'accepted' })
                    .eq('id', otherFollow.id);
                    
                  if (updateError) throw updateError;
                  
                  // Also follow them back
                  const { error: insertError } = await supabase
                    .from('followers')
                    .insert({
                      follower_id: session?.user.id,
                      following_id: userId,
                      status: 'accepted'
                    });
                    
                  if (insertError) throw insertError;
                  
                  Alert.alert('Success', 'You are now following each other!');
                } catch (err) {
                  console.error('Error accepting request:', err);
                  Alert.alert('Error', 'Failed to accept request. Please try again.');
                }
              } 
            }
          ]
        );
      } else {
        // No existing follow relationship, create a new follow request
        const { error: insertError } = await supabase
          .from('followers')
          .insert({
            follower_id: session?.user.id,
            following_id: userId,
            status: 'pending'
          });
          
        if (insertError) throw insertError;
        
        // The notification will be automatically created by the database trigger
        
        Alert.alert('Success', 'Follow request sent successfully');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      Alert.alert('Error', 'Failed to send follow request. Please try again.');
    } finally {
      // Remove the user from connecting state
      setConnectingUsers(connectingUsers.filter(id => id !== userId));
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => router.push({
            pathname: '/profile/[id]' as any,
            params: { id: item.user_id }
          })}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.user.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.username}>{item.user.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#A0A3BD" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.postContent}>{item.content}</Text>
      
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons 
            name={item.is_liked ? "heart" : "heart-outline"} 
            size={22} 
            color={item.is_liked ? "#FF6B6B" : "#6E7191"} 
          />
          <Text style={[styles.actionText, item.is_liked && { color: '#FF6B6B' }]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleComment(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#6E7191" />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleShare(item.id)}
        >
          <Ionicons name="share-social-outline" size={22} color="#6E7191" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {item.user_id !== session?.user.id && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleConnect(item.user_id)}
            disabled={connectingUsers.includes(item.user_id)}
          >
            {connectingUsers.includes(item.user_id) ? (
              <ActivityIndicator size="small" color="#5561F5" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={22} color="#6E7191" />
                <Text style={styles.actionText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderInterestFilter = () => (
    <View style={styles.interestsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity 
          style={[
            styles.interestChip, 
            selectedInterests.length === 0 && styles.selectedInterestChip
          ]}
          onPress={() => setSelectedInterests([])}
        >
          <Text 
            style={[
              styles.interestText,
              selectedInterests.length === 0 && styles.selectedInterestText
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        
        {interests.map((interest) => (
          <TouchableOpacity 
            key={interest}
            style={[
              styles.interestChip,
              selectedInterests.includes(interest) && styles.selectedInterestChip
            ]}
            onPress={() => {
              if (selectedInterests.includes(interest)) {
                setSelectedInterests(selectedInterests.filter(i => i !== interest));
              } else {
                setSelectedInterests([...selectedInterests, interest]);
              }
            }}
          >
            <Text 
              style={[
                styles.interestText,
                selectedInterests.includes(interest) && styles.selectedInterestText
              ]}
            >
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Add a separate function to fetch just the notification counts
  const fetchNotificationCounts = async () => {
    try {
      console.log('Fetching notification counts...');
      // Fetch unread notifications
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', session?.user.id)
        .eq('read', false);
      
      if (error) {
        console.error('Error fetching notifications count:', error);
        return;
      }
      
      const count = notifs?.length || 0;
      console.log(`Found ${count} unread notifications`);
      setNotifications(count);
    } catch (err) {
      console.error('Error in fetchNotificationCounts:', err);
    }
  };

  // Register global function to update notification badges
  useEffect(() => {
    // Define the global function that will be called from other screens
    global.updateNotificationBadges = (forceCount?: number) => {
      console.log('Global notification update triggered', forceCount !== undefined ? `with forced count: ${forceCount}` : '');
      
      if (forceCount !== undefined) {
        // If a specific count is provided, use it directly and skip the database check
        console.log(`IMPORTANT: Setting notifications count to forced value: ${forceCount}`);
        setNotifications(forceCount);
        
        // If forced to 0, also update the local database state for consistency
        if (forceCount === 0) {
          console.log('Forced count is 0 - updating local DB state for consistency');
          try {
            // This is a fire-and-forget update to keep DB in sync with UI
            supabase
              .from('notifications')
              .update({ read: true })
              .eq('recipient_id', session?.user.id)
              .eq('read', false)
              .then(({ error }) => {
                if (error) {
                  console.error('Error updating notifications in forced update:', error);
                } else {
                  console.log('Successfully updated all notifications to read in forced update');
                }
              });
          } catch (err) {
            console.error('Error in forced DB update:', err);
          }
        }
      } else {
        // Otherwise fetch the current count from the database
        fetchNotificationCounts();
      }
    };
    
    // Cleanup when component unmounts
    return () => {
      global.updateNotificationBadges = undefined;
    };
  }, []);

  // Add useEffect to update notification count when the screen comes into focus
  useEffect(() => {
    // Initial fetch
    fetchNotificationCounts();
    
    // Check immediately when the app is opened or the component is mounted
    const checkNotificationsOnFocus = () => {
      console.log('Home screen focused - checking notifications');
      fetchNotificationCounts();
    };
    
    // Add event listener for app coming to foreground
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground');
        checkNotificationsOnFocus();
      }
    });
    
    // Also check on regular interval as a fallback - but less frequently now
    const interval = setInterval(() => {
      console.log('Periodic notification check');
      fetchNotificationCounts();
    }, 30000); // Check every 30 seconds instead of 5 seconds
    
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);
  
  // Additional useEffect to check notifications when returning from other screens
  useEffect(() => {
    // This workaround helps detect when user returns to this screen
    const checkAgainAfterDelay = () => {
      // Check once after a very short delay
      setTimeout(() => {
        fetchNotificationCounts();
      }, 300);
      
      // And again after a longer delay to catch any server-side changes
      setTimeout(() => {
        fetchNotificationCounts();
      }, 1500);
    };
    
    // Call the check function whenever the component renders
    checkAgainAfterDelay();
  });

  // Handle swipe gesture
  const handleTouchStart = (e: GestureResponderEvent) => {
    setTouchStart(e.nativeEvent.pageX);
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    setTouchEnd(e.nativeEvent.pageX);
    handleSwipe();
  };

  const handleSwipe = () => {
    // Swipe right (home to bookmarks)
    if (touchStart - touchEnd < -80) { // Require at least 80px swipe
      console.log('Swiping right to bookmarks');
      router.push('/bookmarks');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#A0A3BD"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity onPress={handleSearch}>
            <Ionicons name="search" size={22} color="#5561F5" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/follow-requests')}
          >
            <Ionicons name="people" size={24} color="#6E7191" />
            {pendingFollowRequests > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingFollowRequests}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications" size={24} color="#6E7191" />
            {notifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/messages')}
          >
            <Ionicons name="chatbubbles" size={24} color="#6E7191" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person" size={24} color="#6E7191" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#6E7191" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Interest Filter */}
      {renderInterestFilter()}
      
      {/* Posts */}
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.postsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#5561F5']}
            tintColor="#5561F5"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#A0A3BD" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No posts found</Text>
          </View>
        }
      />
      
      {/* Create Post Button */}
      <TouchableOpacity 
        style={styles.createPostButton}
        onPress={() => router.push('/create-post')}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      {/* Non-functional Connect Icon */}
      <View style={styles.connectIcon}>
        <Ionicons name="people" size={24} color="#FFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD', // Light background with subtle blue tint
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6E7191',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 0,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4FC',
    borderRadius: 30,
    paddingHorizontal: 18,
    marginRight: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#EEEFF5',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1A1D3F',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 18,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  interestsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 30,
    backgroundColor: '#F3F4FC',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#EEEFF5',
  },
  selectedInterestChip: {
    backgroundColor: '#5561F5',
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  interestText: {
    color: '#6E7191',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedInterestText: {
    color: '#FFF',
  },
  postsList: {
    padding: 12,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    transform: [{ scale: 1.0 }],
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  timestamp: {
    fontSize: 12,
    color: '#6E7191',
    marginTop: 2,
  },
  postContent: {
    fontSize: 16,
    color: '#1A1D3F',
    marginBottom: 18,
    lineHeight: 24,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    paddingTop: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 22,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  actionText: {
    marginLeft: 6,
    color: '#6E7191',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6E7191',
    marginBottom: 10,
    fontWeight: '500',
  },
  createPostButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    // Create a slight pulse effect
    transform: [{ scale: 1.0 }], // We'll animate this with useEffect in a real implementation
  },
  connectIcon: {
    position: 'absolute',
    bottom: 100, // Position above the create post button
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4CAF50', // Green color for the connect icon
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}); 