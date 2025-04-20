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
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.user.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.conversationInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>{item.user.username}</Text>
          <Text style={styles.time}>
            {new Date(item.last_message_time).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'No messages yet'}
        </Text>
        {item.unread_count > 0 && (
          <View style={styles.newMessageIndicator} />
        )}
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

      <TouchableOpacity 
        style={styles.newChatButton}
        onPress={() => router.push('/search')}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  time: {
    fontSize: 12,
    color: '#A0A3BD',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6E7191',
    marginTop: 2,
  },
  newMessageIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5561F5',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6E7191',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6E7191',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  newChatButton: {
    backgroundColor: '#5561F5',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    right: 20,
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
    color: '#A0A3BD',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1D3F',
  },
  searchButton: {
    padding: 10,
  },
  conversationsList: {
    padding: 10,
  },
  backButton: {
    padding: 5,
  },
}); 