import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type FollowRequest = {
  id: string;
  follower: {
    id: string;
    username: string;
    full_name: string;
  };
  created_at: string;
};

export default function FollowRequests() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('followers')
        .select(`
          id,
          created_at,
          follower:profiles!followers_follower_id_fkey(
            id,
            username,
            full_name
          )
        `)
        .eq('following_id', session?.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedRequests = data.map(request => ({
        ...request,
        follower: request.follower[0] || { 
          id: 'unknown',
          username: 'Unknown',
          full_name: 'Unknown User'
        }
      }));

      setRequests(processedRequests);
    } catch (error) {
      console.error('Error fetching follow requests:', error);
      Alert.alert('Error', 'Failed to load follow requests. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAccept = async (requestId: string, followerId: string) => {
    try {
      const { error } = await supabase
        .from('followers')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error accepting follow request:', error);
      Alert.alert('Error', 'Failed to accept follow request. Please try again.');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error rejecting follow request:', error);
      Alert.alert('Error', 'Failed to reject follow request. Please try again.');
    }
  };

  const renderRequest = ({ item }: { item: FollowRequest }) => (
    <View style={styles.requestContainer}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => router.push({
          pathname: '/profile/[id]',
          params: { id: item.follower.id }
        })}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.follower.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.username}>{item.follower.username}</Text>
          <Text style={styles.fullName}>{item.follower.full_name}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAccept(item.id, item.follower.id)}
        >
          <Text style={styles.actionButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
        >
          <Text style={[styles.actionButtonText, styles.rejectButtonText]}>
            Reject
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading follow requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.requestsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#306998']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No follow requests</Text>
          </View>
        }
      />
    </View>
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
  requestsList: {
    padding: 10,
  },
  requestContainer: {
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
    alignItems: 'center',
    marginBottom: 15,
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
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  acceptButton: {
    backgroundColor: '#306998',
  },
  rejectButton: {
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectButtonText: {
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