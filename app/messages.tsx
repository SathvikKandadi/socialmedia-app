import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Conversation = {
  id: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  user: {
    id: string;
    username: string;
    full_name: string;
  };
};

export default function Messages() {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      // Get basic conversation data using the correct column names (participant1_id and participant2_id)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, last_message, last_message_time, participant1_id, participant2_id')
        .or(`participant1_id.eq.${session?.user.id},participant2_id.eq.${session?.user.id}`)
        .order('last_message_time', { ascending: false });

      if (conversationsError) throw conversationsError;
      
      // Process each conversation to include user data
      const processedConversations = [];
      
      for (const conversation of conversationsData || []) {
        // Determine which user ID is the other participant
        const otherUserId = conversation.participant1_id === session?.user.id 
          ? conversation.participant2_id 
          : conversation.participant1_id;
        
        // Fetch the other user's profile
        const { data: userData } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .eq('id', otherUserId)
          .single();
          
        processedConversations.push({
          id: conversation.id,
          last_message: conversation.last_message || '',
          last_message_time: conversation.last_message_time || new Date().toISOString(),
          // Setting default unread_count to 0 since column doesn't exist
          unread_count: 0,
          user: userData || { 
            id: 'unknown',
            username: 'Unknown',
            full_name: 'Unknown User'
          }
        });
      }

      setConversations(processedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      Alert.alert('Error', 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchConversations();
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq('id', session?.user.id)
        .limit(10);

      if (error) throw error;

      const searchResults = data.map(user => ({
        id: `search-${user.id}`,
        last_message: '',
        last_message_time: '',
        unread_count: 0,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name
        }
      }));

      setConversations(searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    if (conversation.id.startsWith('search-')) {
      // Start a new conversation
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.user.id }
      });
    } else {
      // Open existing conversation
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id }
      });
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={styles.conversationContainer}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.user.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={styles.username}>{item.user.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.last_message_time).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.messageContainer}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message || 'No messages yet'}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
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
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <Ionicons name="search" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conversationsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#306998']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'No conversations'}
            </Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchButton: {
    padding: 10,
  },
  conversationsList: {
    padding: 10,
  },
  conversationContainer: {
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
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#306998',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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