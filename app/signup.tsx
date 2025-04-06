import { useState } from 'react';
import { Text, View, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const INTERESTS = [
  "Acting", "Abacus", "Art", "Baking", "Beauty", "Calligraphy", 
  "Coding", "Cooking", "Comedy", "Dance", "Design", "DIY", 
  "Gaming", "Fitness", "Gardening", "Music", "Poetry", "Photography", 
  "Reading", "Singing", "Sports", "Tech", "Travel", "Writing"
];

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleSignup = async () => {
    if (!fullName || !username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (selectedInterests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return;
    }

    try {
      setLoading(true);
      
      // First, check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        Alert.alert('Error', 'Username is already taken');
        return;
      }

      // Create the user account
      await signUp(email, password, {
        full_name: fullName,
        username: username,
        interests: selectedInterests,
      });

      Alert.alert(
        'Success',
        'Please check your email for verification link',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={styles.interestsContainer}>
            <Text style={styles.label}>Select Interests (3-5)</Text>
            <Text style={styles.subLabel}>Selected: {selectedInterests.length}/5</Text>
            <View style={styles.interestsGrid}>
              {INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestButton,
                    selectedInterests.includes(interest) && styles.selectedInterest
                  ]}
                  onPress={() => toggleInterest(interest)}
                  disabled={loading}
                >
                  <Text style={[
                    styles.interestText,
                    selectedInterests.includes(interest) && styles.selectedInterestText
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Login</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  interestsContainer: {
    marginBottom: 20,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  selectedInterest: {
    backgroundColor: '#306998',
  },
  interestText: {
    color: '#333333',
    fontSize: 14,
  },
  selectedInterestText: {
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#306998',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  footerText: {
    color: '#666666',
    fontSize: 16,
  },
  linkText: {
    color: '#306998',
    fontSize: 16,
    fontWeight: '600',
  },
}); 