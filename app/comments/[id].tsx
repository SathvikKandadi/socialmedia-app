import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    full_name: string;
  };
  likes_count: number;
  is_liked: boolean;
};

export default function Comments() {
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      setLoading(true);

      // First get the comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          likes_count:likes(count)
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Process each comment
      const processedComments = [];
      
      for (const comment of commentsData || []) {
        // Get user data separately
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', comment.user_id)
          .single();

        if (userError) {
          console.error('Error fetching user info:', userError);
        }
        
        // Check if user liked this comment
        const { data: likeData } = await supabase
          .from('likes')
          .select('*')
          .eq('comment_id', comment.id)
          .eq('user_id', session?.user.id)
          .maybeSingle();
        
        processedComments.push({
          ...comment,
          likes_count: comment.likes_count[0]?.count || 0,
          is_liked: !!likeData,
          user: userData || { username: 'Unknown', full_name: 'Unknown User' }
        });
      }

      setComments(processedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (commentId: string) => {
    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const isLiked = comment.is_liked;
      
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', session?.user.id);
          
        if (error) throw error;
        
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, is_liked: false, likes_count: c.likes_count - 1 } 
            : c
        ));
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({ comment_id: commentId, user_id: session?.user.id, is_like: true });
          
        if (error) throw error;
        
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, is_liked: true, likes_count: c.likes_count + 1 } 
            : c
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: session?.user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        <View style={styles.userInfo}>
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
        </View>
      </View>
      
      <Text style={styles.commentContent}>{item.content}</Text>
      
      <View style={styles.commentActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons 
            name={item.is_liked ? "heart" : "heart-outline"} 
            size={20} 
            color={item.is_liked ? "#e74c3c" : "#333"} 
          />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.commentsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No comments yet</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Write a comment..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.submitButton, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  commentsList: {
    padding: 10,
  },
  commentContainer: {
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
  commentHeader: {
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  commentContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 5,
    color: '#666',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: '#306998',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
}); 