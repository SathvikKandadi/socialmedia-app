import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type SearchResult = {
  id: string;
  username: string;
  full_name: string;
  bio: string;
  interests: string[];
  followers_count: number;
  is_following: boolean;
};

export default function Search() {
  const { q } = useLocalSearchParams();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState(q as string || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    try {
      setLoading(true);

      // First, get basic user profiles matching the search
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          bio,
          interests,
          followers:followers!followers_following_id_fkey(count)
        `)
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq('id', session?.user.id)
        .limit(20);

      if (error) throw error;

      // Process results to include followers count and following status
      const processedResults = [];
      
      for (const user of data) {
        // Check if current user is following this user
        const { data: followData } = await supabase
          .from('followers')
          .select('*')
          .eq('follower_id', session?.user.id)
          .eq('following_id', user.id)
          .maybeSingle();
          
        processedResults.push({
          ...user,
          followers_count: user.followers[0]?.count || 0,
          is_following: !!followData
        });
      }

      setResults(processedResults);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      const user = results.find(r => r.id === userId);
      if (!user) return;

      const isFollowing = user.is_following;
      
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', session?.user.id)
          .eq('following_id', userId);
          
        if (error) throw error;
        
        setResults(results.map(r => 
          r.id === userId 
            ? { ...r, is_following: false, followers_count: r.followers_count - 1 } 
            : r
        ));
      } else {
        // Instead of inserting directly to followers table, use a custom API endpoint
        // or use the existing follower_requests table if it exists
        try {
          // Approach 1: Try inserting with skip_notification flag (if your DB supports it)
          const { error: followErrorWithFlag } = await supabase
            .from('followers')
            .insert({ 
              follower_id: session?.user.id, 
              following_id: userId,
              status: 'accepted',
              skip_notification: true // This flag needs to be respected by your trigger
            });
            
          if (!followErrorWithFlag) {
            // Success with flag
            updateUIAfterFollow(userId);
            return;
          }
          
          // Approach 2: Try direct insert with minimal data
          const { error: basicFollowError } = await supabase
            .from('followers')
            .insert({ 
              follower_id: session?.user.id, 
              following_id: userId,
            });
            
          if (!basicFollowError) {
            // Success with minimal data
            updateUIAfterFollow(userId);
            return;
          }
          
          // Approach 3: Try using follower_requests instead if it exists
          const { error: requestError } = await supabase
            .from('follow_requests')
            .insert({ 
              follower_id: session?.user.id, 
              following_id: userId
            });
            
          if (!requestError) {
            Alert.alert('Success', 'Follow request sent');
            return;
          }
          
          // If all approaches fail
          throw new Error("Couldn't follow user. Check database permissions.");
        } catch (specificError) {
          console.error('Specific follow error:', specificError);
          throw specificError;
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  // Helper function to update UI after successful follow
  const updateUIAfterFollow = (userId: string) => {
    setResults(results.map(r => 
      r.id === userId 
        ? { ...r, is_following: true, followers_count: r.followers_count + 1 } 
        : r
    ));
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={styles.resultContainer}
      onPress={() => router.push(`/profile?id=${item.id}`)}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.fullName}>{item.full_name}</Text>
          {item.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {item.bio}
            </Text>
          )}
          <View style={styles.interestsContainer}>
            {item.interests.slice(0, 3).map((interest, index) => (
              <View key={index} style={styles.interestChip}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
            {item.interests.length > 3 && (
              <Text style={styles.moreInterests}>
                +{item.interests.length - 3} more
              </Text>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statText}>
          {item.followers_count} followers
        </Text>
        <TouchableOpacity 
          style={[
            styles.followButton,
            item.is_following && styles.followingButton
          ]}
          onPress={() => handleFollow(item.id)}
        >
          <Text style={[
            styles.followButtonText,
            item.is_following && styles.followingButtonText
          ]}>
            {item.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#306998" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    marginLeft: 10,
  },
  clearButton: {
    padding: 5,
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
  resultsList: {
    padding: 10,
  },
  resultContainer: {
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
  userInfo: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fullName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  interestChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  interestText: {
    fontSize: 12,
    color: '#666',
  },
  moreInterests: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  followButton: {
    backgroundColor: '#306998',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  followingButtonText: {
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
}); 