import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const INTERESTS = [
  'Technology',
  'Science',
  'Art',
  'Music',
  'Sports',
  'Travel',
  'Food',
  'Fashion',
  'Gaming',
  'Movies',
  'Books',
  'Fitness',
  'Photography',
  'Nature',
  'Business'
];

export default function EditProfile() {
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username, bio, interests')
        .eq('id', session?.user.id)
        .single();

      if (error) throw error;

      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setBio(data.bio || '');
      setSelectedInterests(data.interests || []);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      } else {
        Alert.alert('Error', 'You can select up to 5 interests');
      }
    }
  };

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (selectedInterests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return;
    }

    try {
      setSaving(true);

      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', session?.user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        Alert.alert('Error', 'Username is already taken');
        return;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          interests: selectedInterests,
        })
        .eq('id', session?.user.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            maxLength={50}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username"
            maxLength={30}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            multiline
            maxLength={200}
          />
          <Text style={styles.characterCount}>
            {bio.length}/200 characters
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Interests *</Text>
          <Text style={styles.subLabel}>
            Select 3-5 interests ({selectedInterests.length}/5)
          </Text>
          <View style={styles.interestsContainer}>
            {INTERESTS.map((interest) => (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.interestChip,
                  selectedInterests.includes(interest) && styles.selectedInterestChip
                ]}
                onPress={() => toggleInterest(interest)}
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
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  saveButton: {
    backgroundColor: '#306998',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
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
}); 