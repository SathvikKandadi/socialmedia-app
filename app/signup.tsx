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
  FlatList,
  Modal
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

// Available interests to choose from
const AVAILABLE_INTERESTS = [
  'Technology', 'Programming', 'Design', 'UX/UI', 'Mobile Apps',
  'Web Development', 'Data Science', 'AI/ML', 'Cloud Computing',
  'DevOps', 'Blockchain', 'IoT', 'Gaming', 'Cybersecurity',
  'Digital Marketing', 'E-commerce', 'Startups', 'Product Management',
  'Remote Work', 'Career Growth'
];

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Account info, Step 2: Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  const handleNext = () => {
    if (!email || !password || !username || !fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setStep(2);
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(item => item !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      } else {
        Alert.alert('Limit Reached', 'You can select up to 5 interests');
      }
    }
  };

  const handleSignup = async () => {
    if (selectedInterests.length === 0) {
      Alert.alert('Error', 'Please select at least one interest');
      return;
    }

    try {
      setLoading(true);
      const { emailConfirmationRequired } = await signUp(email, password, {
        username: username,
        full_name: fullName,
        interests: selectedInterests
      });
      
      if (emailConfirmationRequired) {
        // Show email confirmation message
        setShowEmailConfirmation(true);
      } else {
        // If no email confirmation required (rare case with some Supabase settings), proceed to home
        router.replace('/home');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmedEmail = () => {
    setShowEmailConfirmation(false);
    router.replace('/login');
  };

  // Filter interests based on search query
  const filteredInterests = searchQuery.trim() === '' 
    ? AVAILABLE_INTERESTS 
    : AVAILABLE_INTERESTS.filter(interest => 
        interest.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const renderInterestItem = ({ item }: { item: string }) => {
    const isSelected = selectedInterests.includes(item);
    return (
      <TouchableOpacity 
        style={[styles.interestChip, isSelected && styles.selectedInterestChip]} 
        onPress={() => toggleInterest(item)}
      >
        {isSelected && (
          <Ionicons name="checkmark-circle" size={16} color="#5561F5" style={styles.checkIcon} />
        )}
        <Text style={[styles.interestText, isSelected && styles.selectedInterestText]}>
          {item}
        </Text>
      </TouchableOpacity>
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
        {step === 1 ? (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressIndicator, { width: '50%' }]} />
              </View>
              <Text style={styles.progressText}>Step 1 of 2</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={22} color="#6E7191" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#A0A3BD"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="at-outline" size={22} color="#6E7191" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#A0A3BD"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={22} color="#6E7191" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#A0A3BD"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={22} color="#6E7191" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#A0A3BD"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={handleNext}
              >
                <Text style={styles.signupButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Select Interests</Text>
              <Text style={styles.subtitle}>Choose up to 5 topics that interest you</Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressIndicator, { width: '100%' }]} />
              </View>
              <Text style={styles.progressText}>Step 2 of 2</Text>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#A0A3BD" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search interests..."
                placeholderTextColor="#A0A3BD"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#A0A3BD" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.interestsContainer}>
              <Text style={styles.selectionCount}>
                {selectedInterests.length}/5 interests selected
              </Text>
              
              <View style={styles.interestsList}>
                {filteredInterests.length > 0 ? (
                  filteredInterests.map((interest, index) => (
                    <React.Fragment key={interest}>
                      {renderInterestItem({ item: interest })}
                    </React.Fragment>
                  ))
                ) : (
                  <Text style={styles.noResultsText}>No matching interests found</Text>
                )}
              </View>
            </View>

            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(1)}
              >
                <Ionicons name="arrow-back" size={18} color="#5561F5" style={{ marginRight: 8 }} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.signupButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By signing up, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Email Confirmation Modal */}
      <Modal
        visible={showEmailConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEmailConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="mail" size={50} color="#5561F5" style={styles.modalIcon} />
            
            <Text style={styles.modalTitle}>Verify Your Email</Text>
            
            <Text style={styles.modalText}>
              We've sent a confirmation link to:
            </Text>
            
            <Text style={styles.emailText}>{email}</Text>
            
            <Text style={styles.modalText}>
              Please check your inbox and click the verification link to complete your registration.
            </Text>
            
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleConfirmedEmail}
            >
              <Text style={styles.modalButtonText}>I've Confirmed My Email</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.resendButton}
              onPress={() => {
                setShowEmailConfirmation(false);
                handleSignup();
              }}
            >
              <Text style={styles.resendButtonText}>Resend Confirmation Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6E7191',
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#EEEFF5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: '#5561F5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6E7191',
    textAlign: 'right',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEFF5',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1D3F',
  },
  signupButton: {
    backgroundColor: '#5561F5',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  interestsContainer: {
    marginBottom: 24,
  },
  selectionCount: {
    fontSize: 15,
    color: '#6E7191',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  interestChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 6,
    borderWidth: 1,
    borderColor: '#EEEFF5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedInterestChip: {
    backgroundColor: '#F0F2FF',
    borderColor: '#5561F5',
  },
  checkIcon: {
    marginRight: 6,
  },
  interestText: {
    color: '#6E7191',
    fontSize: 14,
  },
  selectedInterestText: {
    color: '#5561F5',
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEFF5',
    flexDirection: 'row',
    flex: 0.45,
  },
  backButtonText: {
    color: '#5561F5',
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    marginBottom: 30,
  },
  termsText: {
    fontSize: 13,
    color: '#6E7191',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#5561F5',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    color: '#6E7191',
    fontSize: 14,
  },
  loginLink: {
    color: '#5561F5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEFF5',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1D3F',
  },
  noResultsText: {
    fontSize: 16,
    color: '#6E7191',
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#6E7191',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5561F5',
    marginBottom: 12,
  },
  modalButton: {
    backgroundColor: '#5561F5',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendButtonText: {
    color: '#5561F5',
    fontSize: 14,
    fontWeight: '500',
  },
}); 