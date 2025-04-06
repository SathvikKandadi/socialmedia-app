import { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender: {
    id: string;
    username: string;
    full_name: string;
  };
};

type ChatUser = {
  id: string;
  username: string;
  full_name: string;
};

export default function Chat() {
  const { session } = useAuth();
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    fetchMessages();
    fetchChatUser();
    subscribeToMessages();
  }, [id]);

  const fetchChatUser = async () => {
    try {
      const userId = typeof id === 'string' ? id : id[0];
      
      // Check if this is a conversation ID or user ID
      const { data: conversationCheck } = await supabase
        .from('conversations')
        .select('participant1_id, participant2_id')
        .eq('id', userId)
        .maybeSingle();
      
      let profileId = userId;
      
      // If it's a conversation ID, determine which participant is the other user
      if (conversationCheck) {
        // Figure out which participant is not the current user
        profileId = conversationCheck.participant1_id === session?.user.id 
          ? conversationCheck.participant2_id 
          : conversationCheck.participant1_id;
      }
      
      // Now fetch the actual user profile
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      setChatUser(data);
    } catch (error) {
      console.error('Error fetching chat user:', error);
      Alert.alert('Error', 'Failed to load chat user. Please try again.');
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const userId = typeof id === 'string' ? id : id[0];
      
      // Check if ID is a UUID (conversation) or user ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      
      // If it's not a UUID format, it might be a user ID and no messages exist yet
      if (!isUUID) {
        // This is a new conversation with a user, so there are no messages yet
        setMessages([]);
        setLoading(false);
        return;
      }
      
      console.log('Fetching messages for conversation:', userId);
      
      // First, verify that we are part of this conversation
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('participant1_id, participant2_id')
        .eq('id', userId)
        .single();
        
      if (conversationError) {
        console.error('Error verifying conversation:', conversationError);
        throw conversationError;
      }
      
      // Verify the current user is actually part of this conversation
      const currentUserId = session?.user.id;
      const isParticipant = 
        conversationData.participant1_id === currentUserId || 
        conversationData.participant2_id === currentUserId;
        
      if (!isParticipant) {
        console.error('Current user is not a participant in this conversation');
        throw new Error('You are not authorized to view this conversation');
      }
      
      console.log('Conversation verified, participants:', conversationData);
      
      // SIMPLIFIED APPROACH: Direct query without joins to avoid any foreign key issues
      console.log('Fetching raw messages data from database');
      
      const { data: rawMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, conversation_id')
        .eq('conversation_id', userId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      console.log(`Found ${rawMessages?.length || 0} raw messages:`, 
        rawMessages?.map(m => ({ id: m.id, content_length: m.content?.length || 0 }))
      );
      
      if (!rawMessages || rawMessages.length === 0) {
        console.warn('No messages found');
        setMessages([]);
        setLoading(false);
        return;
      }
      
      // Process the messages to add sender information
      const processedMessages: Message[] = [];
      
      for (const message of rawMessages) {
        console.log(`Processing message ${message.id}:`, {
          content_preview: message.content?.substring(0, 20) || 'EMPTY',
          content_length: message.content?.length || 0,
          sender_id: message.sender_id
        });
        
        // Fetch the sender's profile
        const { data: senderData, error: senderError } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .eq('id', message.sender_id)
          .single();
          
        if (senderError) {
          console.warn(`Couldn't get sender profile for message: ${message.id}`, senderError);
        }
        
        // Create the full message object
        const fullMessage: Message = {
          id: message.id,
          content: message.content || '',
          created_at: message.created_at,
          sender_id: message.sender_id,
          sender: senderData || {
            id: message.sender_id,
            username: 'Unknown User',
            full_name: 'Unknown'
          }
        };
        
        processedMessages.push(fullMessage);
      }

      console.log('Processed messages:', processedMessages.length);
      
      // Log a sample of the processed messages to verify content
      if (processedMessages.length > 0) {
        console.log('Sample message:', {
          id: processedMessages[0].id,
          content_preview: processedMessages[0].content?.substring(0, 30),
          sender: processedMessages[0].sender.username
        });
      }
      
      setMessages(processedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const userId = typeof id === 'string' ? id : id[0];
    
    // Check if ID is a UUID (conversation) or user ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    // If it's not a UUID format, it might be a user ID and no conversation exists yet
    if (!isUUID) {
      // We don't have a conversation ID yet, so we can't subscribe
      return () => {}; // Return empty cleanup function
    }
    
    console.log('Setting up real-time subscription for conversation:', userId);
    
    // This is a conversation ID, so set up subscription
    const subscription = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${userId}`
        },
        async (payload) => {
          try {
            console.log('New message received:', payload.new);
            const newMsg = payload.new as any;
            
            // Log detailed info about the received message
            console.log('Message details:', {
              id: newMsg.id,
              content: newMsg.content,
              content_length: newMsg.content?.length || 0,
              sender_id: newMsg.sender_id
            });
            
            // Fetch the sender profile
            const { data: senderData } = await supabase
              .from('profiles')
              .select('id, username, full_name')
              .eq('id', newMsg.sender_id)
              .single();
              
            const processedNewMessage: Message = {
              id: newMsg.id,
              content: newMsg.content || '',
              created_at: newMsg.created_at,
              sender_id: newMsg.sender_id,
              sender: senderData || {
                id: newMsg.sender_id,
                username: 'Unknown User',
                full_name: 'Unknown'
              }
            };
            
            console.log('Processed new message:', {
              id: processedNewMessage.id,
              content_preview: processedNewMessage.content?.substring(0, 30),
              sender: processedNewMessage.sender.username
            });
            
            // Add the new message to the state
            setMessages(prev => [...prev, processedNewMessage]);
            
            // Scroll to the bottom
            if (flatListRef.current) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          } catch (error) {
            console.error('Error processing real-time message:', error);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Unsubscribing from messages channel');
      subscription.unsubscribe();
    };
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      const userId = typeof id === 'string' ? id : id[0];
      
      // HANDLE DIFFERENT CASES
      let conversationId;
      let existingConversation = false;
      
      // First, check if this ID represents an existing conversation
      const { data: conversationCheck, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (!checkError && conversationCheck) {
        // This is an existing conversation ID
        conversationId = userId;
        existingConversation = true;
        console.log('Using existing conversation ID:', conversationId);
      } else {
        // Check if this is a valid user ID
        const { data: userCheck, error: userCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();
        
        if (userCheckError || !userCheck) {
          console.error('Invalid user ID:', userCheckError);
          throw new Error('Invalid user or conversation ID. Please try again.');
        }
        
        // This is a valid user ID - create a new conversation
        console.log('Creating new conversation with user:', userId);
        
        // First check if a conversation already exists between these users
        const { data: existingConvs } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${session?.user.id},participant2_id.eq.${userId}),and(participant1_id.eq.${userId},participant2_id.eq.${session?.user.id})`)
          .maybeSingle();
        
        if (existingConvs && existingConvs.id) {
          // Use the existing conversation
          conversationId = existingConvs.id;
          console.log('Found existing conversation:', conversationId);
          
          // Update the URL
          router.replace(`/chat/${conversationId}`);
        } else {
          // Create a new conversation
          const { data: newConversation, error: createError } = await supabase
            .from('conversations')
            .insert({
              participant1_id: session?.user.id,
              participant2_id: userId,
              last_message: newMessage.trim(),
              last_message_time: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating conversation:', createError);
            throw createError;
          }
          
          if (!newConversation || !newConversation.id) {
            throw new Error('Failed to create conversation');
          }
          
          conversationId = newConversation.id;
          console.log('Created new conversation:', conversationId);
          
          // Wait to ensure database consistency
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the conversation was created
          const { data: verifyData, error: verifyError } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .single();
            
          if (verifyError || !verifyData) {
            console.error('Failed to verify new conversation:', verifyError);
            throw new Error('Conversation was created but could not be verified');
          }
          
          // Update the URL
          router.replace(`/chat/${conversationId}`);
        }
      }
      
      // At this point we have a valid conversation ID
      console.log('Sending message to conversation:', conversationId);
      
      // Send the message with received flag set to true
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: newMessage.trim(),
          sender_id: session?.user.id,
          received: true  // This helps with RLS policies
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        throw messageError;
      }

      // Message sent successfully
      setNewMessage('');
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
      
      // Update conversation's last message
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: newMessage.trim(),
          last_message_time: new Date().toISOString()
        })
        .eq('id', conversationId);
        
      if (updateError) {
        console.warn('Failed to update last message:', updateError);
      }
      
      // Refresh messages
      if (!existingConversation) {
        // For new conversations, we need to refresh the page
        // BUT window.location doesn't exist in React Native, so use router.replace instead
        router.replace(`/chat/${conversationId}`);
        
        // After navigation, we need to manually refresh the data
        setTimeout(() => {
          fetchMessages();
          fetchChatUser();
        }, 500);
      } else {
        // Just refresh messages for existing conversations
        fetchMessages();
      }
      
    } catch (error) {
      console.error('Error in message flow:', error);
      Alert.alert('Error', `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchMessages(), fetchChatUser()])
      .catch(error => console.error('Error refreshing data:', error))
      .finally(() => setRefreshing(false));
  };

  const handleFixMessages = async () => {
    try {
      const userId = typeof id === 'string' ? id : id[0];
      
      // Show an alert to confirm
      Alert.alert(
        'Debug Actions',
        'Choose a debug action:',
        [
          {
            text: 'Reload Messages',
            onPress: () => handleRefresh()
          },
          {
            text: 'Fix Message Permissions',
            onPress: async () => {
              // This is a fix that helps with potential RLS issues
              try {
                // 1. Verify conversation
                const { data: conv } = await supabase
                  .from('conversations')
                  .select('participant1_id, participant2_id')
                  .eq('id', userId)
                  .single();
                
                if (!conv) {
                  Alert.alert('Error', 'Conversation not found');
                  return;
                }
                
                // 2. Update all messages to mark as received by both participants
                const { error: updateError } = await supabase
                  .from('messages')
                  .update({ received: true })
                  .eq('conversation_id', userId);
                
                if (updateError) {
                  console.error('Error updating messages:', updateError);
                  Alert.alert('Error', 'Failed to update messages');
                  return;
                }
                
                Alert.alert('Success', 'Messages have been updated. Pull to refresh.');
              } catch (err) {
                console.error('Error fixing messages:', err);
                Alert.alert('Error', 'Operation failed');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error in debug action:', error);
    }
  };

  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    // Guard against undefined message properties
    if (!item || !item.id) {
      console.error('Undefined message item:', item);
      return null;
    }
    
    const isOwnMessage = item.sender_id === session?.user.id;
    
    console.log('Rendering message:', {
      id: item.id,
      content: item.content,
      content_length: item.content?.length || 0,
      sender_id: item.sender_id,
      isOwnMessage,
      currentUserId: session?.user.id
    });

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isOwnMessage && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.sender?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={[
          styles.messageContent,
          isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent
        ]}>
          {item.content ? (
            <Text style={styles.messageText} testID="messageText">
              {item.content}
            </Text>
          ) : (
            <Text style={styles.emptyMessageText}>
              [Empty message]
            </Text>
          )}
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          {(debugMode || __DEV__) && (
            <Text style={styles.debugText}>ID: {item.id.substring(0, 8)}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerUserInfo}
          onPress={handleFixMessages}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {chatUser?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.username}>{chatUser?.username}</Text>
            <Text style={styles.fullName}>{chatUser?.full_name}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={toggleDebugMode}
          >
            <Ionicons name="bug" size={24} color={debugMode ? "#e74c3c" : "#999"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color="#306998" />
          </TouchableOpacity>
        </View>
      </View>

      {debugMode && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugInfo}>Messages: {messages.length}</Text>
          <Text style={styles.debugInfo}>Conversation ID: {typeof id === 'string' ? id : id[0]}</Text>
          <Text style={styles.debugInfo}>User ID: {session?.user.id}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#306998']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Text style={styles.emptySubText}>Send a message to start the conversation.</Text>
            {debugMode && (
              <View style={styles.debugMessagePanel}>
                <Text style={styles.debugTitle}>Why no messages?</Text>
                <Text style={styles.debugInfo}>1. New conversation</Text>
                <Text style={styles.debugInfo}>2. RLS issues</Text>
                <Text style={styles.debugInfo}>3. Message fetch error</Text>
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={handleRefresh}
                >
                  <Text style={styles.debugButtonText}>Try Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!newMessage.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fullName: {
    fontSize: 12,
    color: '#666',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 12,
    borderRadius: 10,
    maxWidth: '80%',
  },
  ownMessageContent: {
    backgroundColor: '#306998',
  },
  otherMessageContent: {
    backgroundColor: '#e5e5ea',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  emptyMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 200,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 5,
    marginLeft: 5,
  },
  debugPanel: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  debugInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  debugText: {
    fontSize: 10,
    color: 'rgba(0, 0, 0, 0.5)',
    alignSelf: 'flex-end',
  },
  debugMessagePanel: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    alignItems: 'center',
  },
  debugButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#306998',
    borderRadius: 5,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
  },
}); 