import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Post = {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

type Profile = {
  username: string;
  full_name: string;
  bio: string;
  interests: string[];
  followers_count: number;
  following_count: number;
  is_following: boolean;
};

export default function Profile() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      // Fetch basic profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, full_name, bio, interests')
        .eq('id', session?.user.id)
        .single();

      if (profileError) throw profileError;

      // Count followers
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', session?.user.id);

      // Count following
      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', session?.user.id);

      // Fetch user's posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', session?.user.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Process posts to add likes and comments count
      const processedPosts = [];
      
      for (const post of postsData || []) {
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
        const { data: likeData } = await supabase
          .from('likes')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', session?.user.id)
          .maybeSingle();
          
        processedPosts.push({
          ...post,
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0,
          is_liked: !!likeData
        });
      }

      // Create processed profile with followers/following counts
      const processedProfile = {
        ...profileData,
        followers_count: followersCount || 0,
        following_count: followingCount || 0,
        is_following: false, // Not applicable for own profile
      };

      setProfile(processedProfile);
      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
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

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditedContent(post.content);
    setIsEditing(true);
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postId)
                .eq('user_id', session?.user.id);
                
              if (error) throw error;
              
              // Remove the deleted post from state
              setPosts(posts.filter(p => p.id !== postId));
              Alert.alert("Success", "Post deleted successfully");
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editedContent })
        .eq('id', editingPost.id)
        .eq('user_id', session?.user.id);
        
      if (error) throw error;
      
      // Update the post in state
      setPosts(posts.map(p => 
        p.id === editingPost.id 
          ? { ...p, content: editedContent } 
          : p
      ));
      
      // Close edit mode
      setIsEditing(false);
      setEditingPost(null);
      Alert.alert("Success", "Post updated successfully");
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post. Please try again.');
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postContainer}>
      <Text style={styles.postContent}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
      <View style={styles.postActions}>
        <View style={styles.actionButton}>
          <Ionicons 
            name={item.is_liked ? "heart" : "heart-outline"} 
            size={24} 
            color={item.is_liked ? "#e74c3c" : "#333"} 
          />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </View>
        <View style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#333" />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </View>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEditPost(item)}
        >
          <Ionicons name="create-outline" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDeletePost(item.id)}
        >
          <Ionicons name="trash-outline" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {profile?.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{profile?.username}</Text>
          <Text style={styles.fullName}>{profile?.full_name}</Text>
          <Text style={styles.bio}>{profile?.bio}</Text>
        </View>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditProfile}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile?.followers_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{profile?.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      <View style={styles.interestsContainer}>
        <Text style={styles.interestsTitle}>Interests</Text>
        <View style={styles.interestsList}>
          {profile?.interests.map((interest, index) => (
            <View key={index} style={styles.interestChip}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        data={posts}
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
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
      />

      {/* Edit Post Modal */}
      <Modal
        visible={isEditing}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditing(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Post</Text>
            
            <TextInput
              style={styles.editInput}
              value={editedContent}
              onChangeText={setEditedContent}
              multiline
              numberOfLines={5}
              placeholder="Edit your post content..."
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 5,
  },
  profileHeader: {
    backgroundColor: '#fff',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#306998',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  interestsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  interestsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#333',
    fontSize: 14,
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
  postContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
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
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    minHeight: 100,
    marginBottom: 15,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#306998',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 