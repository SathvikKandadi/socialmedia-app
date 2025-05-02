import { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, userData: any) => Promise<{ emailConfirmationRequired: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if a user profile exists, if not create one with basic information
  const ensureUserProfileExists = async (userId: string) => {
    try {
      console.log('Checking if profile exists for user:', userId);
      
      // Check if profile exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        // PGRST116 is "Row not found" error, which is expected if profile doesn't exist
        console.error('Error checking profile:', profileCheckError);
        return;
      }
      
      // If profile doesn't exist, create it
      if (!existingProfile) {
        console.log('Profile does not exist, creating one...');
        
        // Get user details from auth.users
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user data:', userError);
          return;
        }
        
        const user = userData.user;
        const userMetadata = user.user_metadata || {};
        
        // Create basic profile
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: userMetadata.username || user.email?.split('@')[0] || `user_${Date.now()}`,
            full_name: userMetadata.full_name || 'User',
            interests: userMetadata.interests || []
          });
        
        if (createError) {
          console.error('Error creating profile:', createError);
        } else {
          console.log('Successfully created profile for user:', userId);
        }
      } else {
        console.log('Profile already exists for user:', userId);
      }
    } catch (err) {
      console.error('Error in ensureUserProfileExists:', err);
    }
  };

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    console.log('Initializing Supabase auth...');
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error.message);
          setError(error.message);
        } else {
          console.log('Session retrieved successfully');
          setSession(data.session);
          
          // Ensure profile exists if we have a session
          if (data.session?.user.id) {
            await ensureUserProfileExists(data.session.user.id);
          }
        }
      } catch (err) {
        console.error('Exception during auth initialization:', err);
        setError(err instanceof Error ? err.message : 'Unknown error during auth initialization');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed, event:', _event);
      setSession(session);
      
      // Check if we need to create a profile on sign-in or token refresh
      if (session?.user.id && (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED')) {
        await ensureUserProfileExists(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    setError(null);
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      // Supabase returns session as null when email confirmation is required
      const emailConfirmationRequired = !data.session;

      // If there's a session already, create profile
      if (data.user && data.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: userData.username,
            full_name: userData.full_name,
            interests: userData.interests || [],
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          throw new Error('Failed to create profile. Please try again.');
        }
      }

      // Return if email confirmation is needed
      return { emailConfirmationRequired };
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // After successful sign in, ensure profile exists
      if (data.user) {
        await ensureUserProfileExists(data.user.id);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, error, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 