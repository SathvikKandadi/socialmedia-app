import { Text, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/images/pylogo.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <Text style={styles.tagline}>Connecting talented people</Text>
      
      <View style={styles.buttonContainer}>
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/signup" asChild>
          <TouchableOpacity style={[styles.button, styles.signupButton]}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    width: 200,
    height: 200,
  },
  tagline: {
    fontSize: 24,
    color: '#333333',
    marginBottom: 50,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 15,
  },
  button: {
    backgroundColor: '#306998', // Python blue
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  signupButton: {
    backgroundColor: '#4B8BBE', // Lighter Python blue
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
