import { useState, useEffect } from 'react';
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
  AppState
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

  // Fetch posts, interests, and other data
  useEffect(() => {
    fetchData();
  }, []);

  // Filter posts when selected interests change
  useEffect(() => {
    if (selectedInterests.length === 0) {
      setFilteredPosts(posts);
    } else {
      // In a real app, you would filter by the user's interests
      // For now, we'll just show all posts
      setFilteredPosts(posts);
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
              // Get user profile
              const { data: userData } = await supabase
                .from('profiles')
                .select('username, full_name')
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
                  full_name: userData?.full_name || 'Unknown User'
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
                  full_name: 'Unknown User'
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
      </View>
      
      <Text style={styles.postContent}>{item.content}</Text>
      
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons 
            name={item.is_liked ? "heart" : "heart-outline"} 
            size={24} 
            color={item.is_liked ? "#e74c3c" : "#333"} 
          />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleComment(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#333" />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleShare(item.id)}
        >
          <Ionicons name="share-social-outline" size={24} color="#333" />
        </TouchableOpacity>
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

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity onPress={handleSearch}>
            <Ionicons name="search" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/follow-requests')}
          >
            <Ionicons name="people" size={24} color="#333" />
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
            <Ionicons name="notifications" size={24} color="#333" />
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
            <Ionicons name="chatbubbles" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#333" />
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
            colors={['#306998']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts found</Text>
          </View>
        }
      />
      
      {/* Create Post Button */}
      <TouchableOpacity 
        style={styles.createPostButton}
        onPress={() => router.push('/create-post')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 15,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  interestsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  interestChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 5,
  },
  selectedInterestChip: {
    backgroundColor: '#306998',
  },
  interestText: {
    color: '#333',
    fontSize: 14,
  },
  selectedInterestText: {
    color: '#fff',
  },
  postsList: {
    padding: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 5,
    color: '#666',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  createPostButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
}); 