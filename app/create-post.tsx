import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePost() {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaSelected, setMediaSelected] = useState(false);

  const handleCreatePost = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: session?.user.id,
          content: content.trim(),
        });

      if (error) throw error;

      router.replace('/home');
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.message || 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openMediaModal = () => {
    setMediaModalVisible(true);
  };

  const handleSelectPhoto = () => {
    // This would typically access the photo library
    setMediaSelected(true);
    setMediaModalVisible(false);
    Alert.alert(
      "Photo Selected", 
      "Photo has been selected (mock functionality - no actual photo storage)",
      [{ text: "OK" }]
    );
  };

  const handleTakePhoto = () => {
    // This would typically open the camera
    setMediaSelected(true);
    setMediaModalVisible(false);
    Alert.alert(
      "Photo Captured", 
      "Photo has been captured (mock functionality - no actual photo storage)",
      [{ text: "OK" }]
    );
  };

  const handleTakeVideo = () => {
    // This would typically open the camera for video
    setMediaSelected(true);
    setMediaModalVisible(false);
    Alert.alert(
      "Video Captured", 
      "Video has been captured (mock functionality - no actual video storage)",
      [{ text: "OK" }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#5561F5" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity 
            style={[styles.postButton, !content.trim() && styles.postButtonDisabled]}
            onPress={handleCreatePost}
            disabled={loading || !content.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          <TextInput
            style={styles.contentInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#A0A3BD"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            editable={!loading}
          />
          
          {mediaSelected && (
            <View style={styles.mediaPreviewContainer}>
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="image" size={40} color="#5561F5" />
                <Text style={styles.mediaPlaceholderText}>Media selected</Text>
              </View>
              <TouchableOpacity 
                style={styles.removeMediaButton}
                onPress={() => setMediaSelected(false)}
              >
                <Ionicons name="close-circle" size={24} color="#FF4D4F" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.toolbarContainer}>
          <TouchableOpacity 
            style={styles.mediaButton}
            onPress={openMediaModal}
          >
            <Ionicons name="camera" size={24} color="#5561F5" />
            <Text style={styles.mediaButtonText}>Photo/Video</Text>
          </TouchableOpacity>
        </View>

        {/* Media Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={mediaModalVisible}
          onRequestClose={() => setMediaModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add to your post</Text>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleSelectPhoto}
              >
                <Ionicons name="images-outline" size={24} color="#5561F5" />
                <Text style={styles.modalOptionText}>Photo Library</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera-outline" size={24} color="#5561F5" />
                <Text style={styles.modalOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleTakeVideo}
              >
                <Ionicons name="videocam-outline" size={24} color="#5561F5" />
                <Text style={styles.modalOptionText}>Record Video</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setMediaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  postButton: {
    backgroundColor: '#5561F5',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 30,
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  postButtonDisabled: {
    backgroundColor: '#A0A3BD',
    shadowOpacity: 0,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  contentInput: {
    fontSize: 18,
    color: '#1A1D3F',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  toolbarContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    backgroundColor: '#FFFFFF',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4FC',
    padding: 10,
    borderRadius: 30,
  },
  mediaButtonText: {
    marginLeft: 6,
    color: '#5561F5',
    fontWeight: '500',
  },
  mediaPreviewContainer: {
    marginTop: 16,
    backgroundColor: '#F3F4FC',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
  },
  mediaPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEFF5',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
  },
  mediaPlaceholderText: {
    color: '#6E7191',
    marginTop: 8,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF5',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1A1D3F',
    marginLeft: 16,
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F3F4FC',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5561F5',
  },
}); 