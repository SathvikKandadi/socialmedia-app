import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePost() {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreatePost = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for your post');
      return;
    }

    try {
      setLoading(true);

      // Check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session?.user.id)
        .single();

      // If profile doesn't exist, create one
      if (profileError || !profileData) {
        console.log('Profile not found, creating one...');
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData?.user) {
          const userMetadata = userData.user.user_metadata;
          
          const { error: createProfileError } = await supabase
            .from('profiles')
            .insert({
              id: session?.user.id,
              username: userMetadata?.username || `user${Math.floor(Math.random() * 10000)}`,
              full_name: userMetadata?.full_name || 'Anonymous User',
              interests: userMetadata?.interests || [],
            });

          if (createProfileError) {
            throw createProfileError;
          }
        }
      }

      // Now create the post
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: session?.user.id,
          content: content.trim(),
        });

      if (error) throw error;

      Alert.alert('Success', 'Post created successfully!');
      router.back();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity 
          style={[styles.postButton, loading && styles.disabledButton]}
          onPress={handleCreatePost}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={500}
          autoFocus
        />
        <Text style={styles.characterCount}>
          {content.length}/500 characters
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
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
  postButton: {
    backgroundColor: '#306998',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  input: {
    fontSize: 16,
    color: '#333',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 14,
    marginTop: 10,
  },
}); 