import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string;
  };
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string;
  };
};

export default function Comments() {
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchPostAndComments();
  }, [id]);

  const fetchPostAndComments = async () => {
    try {
      setLoading(true);
      
      // Fetch the post first
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id')
        .eq('id', id)
        .single();
      
      if (postError) throw postError;
      
      // Fetch user information
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('id', postData.user_id)
        .single();
      
      if (userError) throw userError;
      
      setPost({
        id: postData.id,
        content: postData.content,
        created_at: postData.created_at,
        user: userData
      });
      
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      
      if (commentsError) throw commentsError;
      
      // Fetch user info for each comment
      const processedComments = await Promise.all(
        commentsData.map(async (comment) => {
          const { data: commentUser } = await supabase
            .from('profiles')
            .select('id, username, full_name')
            .eq('id', comment.user_id)
            .single();
          
          return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            user: commentUser || {
              id: comment.user_id,
              username: 'Unknown',
              full_name: 'Unknown User'
            }
          };
        })
      );
      
      setComments(processedComments);
    } catch (error) {
      console.error('Error fetching post and comments:', error);
      Alert.alert('Error', 'Failed to load post and comments. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPostAndComments();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      setSubmitting(true);
      
      // Insert comment
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: session?.user.id,
          content: newComment.trim()
        });
      
      if (error) throw error;
      
      // Add the new comment to the list
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('id', session?.user.id)
        .single();
      
      const newCommentObj: Comment = {
        id: Date.now().toString(), // Temporary ID until refresh
        content: newComment.trim(),
        created_at: new Date().toISOString(),
        user: userData || {
          id: session?.user.id || 'unknown',
          username: 'You',
          full_name: 'Your Name'
        }
      };
      
      setComments([...comments, newCommentObj]);
      setNewComment('');
      
      // Refresh to get the real comment ID
      setTimeout(fetchPostAndComments, 500);
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPostHeader = () => {
    if (!post) return null;
    
    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {post.user.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.username}>{post.user.username}</Text>
              <Text style={styles.timestamp}>
                {new Date(post.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.postContent}>{post.content}</Text>
        
        <View style={styles.postFooter}>
          <Text style={styles.commentsCount}>
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </Text>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.user.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Text style={styles.username}>{item.user.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.commentContent}>{item.content}</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5561F5" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#5561F5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderPostHeader}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#5561F5']}
            tintColor="#5561F5"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color="#A0A3BD" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                Be the first to comment
              </Text>
            </View>
          ) : null
        }
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#A0A3BD"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newComment.trim() || submitting) && styles.sendButtonDisabled
          ]}
          onPress={handleSubmitComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4FC',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  timestamp: {
    fontSize: 12,
    color: '#A0A3BD',
  },
  postContent: {
    fontSize: 16,
    color: '#1A1D3F',
    marginBottom: 16,
    lineHeight: 24,
  },
  postFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    paddingTop: 12,
  },
  commentsCount: {
    fontSize: 14,
    color: '#6E7191',
    fontWeight: '500',
  },
  commentContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  commentHeader: {
    flexDirection: 'row',
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentContent: {
    fontSize: 15,
    color: '#1A1D3F',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    padding: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4FC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingRight: 40,
    fontSize: 16,
    color: '#1A1D3F',
    maxHeight: 100,
  },
  sendButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#5561F5',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#A0A3BD',
    shadowOpacity: 0,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#6E7191',
    textAlign: 'center',
    fontWeight: '500',
  },
}); 