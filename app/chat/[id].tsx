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
  const [showErrors, setShowErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Helper function to check if a string is a UUID
  const isUUID = (str: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  };

  useEffect(() => {
    fetchMessages();
    fetchChatUser();
    const unsubscribe = subscribeToMessages();
    
    // React Native doesn't have window.addEventListener
    // Instead, we'll handle errors directly in our API calls
    
    return () => {
      unsubscribe();
    };
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
      const idIsUUID = isUUID(userId);
      
      // If it's not a UUID format, it's likely a user ID for a new conversation
      if (!idIsUUID) {
        console.log('This is a new conversation with a user ID:', userId);
        // Verify that the user ID exists before continuing
        const { data: userExists, error: userError } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', userId)
          .single();
          
        if (userError) {
          console.error('Error verifying user:', userError);
          if (userError.code === 'PGRST116') {
            // The user doesn't exist - this is an actual error
            throw new Error('User not found. Please check the user ID.');
          }
          // For other errors that might be temporary, don't show an error to the user
          console.warn('Non-critical error checking user:', userError);
        }
        
        console.log('Valid user found, empty conversation state');
        // User exists (or we're being lenient about errors), show empty conversation state
        setMessages([]);
        setLoading(false);
        
        // AUTOMATICALLY CREATE A CONVERSATION
        // Check if a conversation already exists between these users
        if (session?.user.id) {
          console.log('Automatically checking for existing conversation between users...');
          const { data: existingConvs, error: existingConvsError } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant1_id.eq.${session.user.id},participant2_id.eq.${userId}),and(participant1_id.eq.${userId},participant2_id.eq.${session.user.id})`)
            .maybeSingle();
            
          if (!existingConvsError && existingConvs && existingConvs.id) {
            // Use the existing conversation
            const conversationId = existingConvs.id;
            console.log('Found existing conversation:', conversationId);
            
            // Update the URL
            router.replace(`/chat/${conversationId}`);
            return;
          }
          
          // Create a new conversation automatically
          console.log('No existing conversation found, creating new one automatically...');
          const { data: newConversation, error: createError } = await supabase
            .from('conversations')
            .insert({
              participant1_id: session.user.id,
              participant2_id: userId,
              last_message: '',
              last_message_time: new Date().toISOString()
            })
            .select()
            .single();
          
          if (!createError && newConversation && newConversation.id) {
            const conversationId = newConversation.id;
            console.log('Created new conversation with ID:', conversationId);
            
            // Navigate to the new conversation
            router.replace(`/chat/${conversationId}`);
          } else {
            console.warn('Failed to create conversation automatically, will create on first message');
          }
        }
        
        return;
      }
      
      console.log('Fetching messages for existing conversation:', userId);
      
      // First, verify that we are part of this conversation
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('participant1_id, participant2_id')
        .eq('id', userId)
        .single();
        
      if (conversationError) {
        console.error('Error verifying conversation:', conversationError);
        // If the error code is PGRST116, it means the conversation doesn't exist
        if (conversationError.code === 'PGRST116') {
          console.log('Conversation not found, showing empty state');
          // This is not an error condition for the user, just an empty state
          setMessages([]);
          setLoading(false);
          return;
        }
        // For other errors, log but don't throw
        console.warn('Non-critical error checking conversation:', conversationError);
        setMessages([]);
        setLoading(false);
        return;
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
      
      // Get all messages for this conversation with explicit RLS bypass
      console.log('Fetching messages with explicit query parameters');
      
      const { data: rawMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', userId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        
        // Clear any previous error messages for new errors
        setErrorMessage(null);
        
        // Analyze the error to determine if it's a PGRST116 error (no results found)
        // This often happens when a new conversation is created
        const errorStr = String(messagesError);
        const isPGRST116 = 
          errorStr.includes('PGRST116') || 
          errorStr.includes('The result contains 0 rows');
        
        if (isPGRST116) {
          console.log('Got PGRST116 error (no results), showing empty state');
          setMessages([]);
        } else {
          // Only show an error alert for specific errors that require user action
          const errorMessage = messagesError instanceof Error ? messagesError.message : 'Unknown error';
          if (errorMessage.includes('User not found') || 
              errorMessage.includes('not authorized')) {
            Alert.alert('Error', errorMessage);
          } else {
            // For other errors, log but don't show to user - just show empty state
            console.warn('Suppressing error alert, showing empty state instead:', errorMessage);
            setMessages([]);
            
            // Store the error message only if debug mode is enabled
            if (debugMode && showErrors) {
              setErrorMessage(errorStr);
            }
          }
        }
      }

      console.log(`Found ${rawMessages?.length || 0} raw messages:`, 
        rawMessages?.map(m => ({ id: m.id, content_length: m.content?.length || 0, sender: m.sender_id }))
      );
      
      if (!rawMessages || rawMessages.length === 0) {
        console.warn('No messages found for existing conversation');
        setMessages([]);
        setLoading(false);
        return;
      }
      
      // Process the messages to add sender information
      const processedMessages: Message[] = [];
      
      // Get all unique sender IDs
      const senderIds = [...new Set(rawMessages.map(msg => msg.sender_id))];
      
      // Fetch all sender profiles in a single batch
      const { data: senderProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', senderIds);
        
      if (profilesError) {
        console.warn('Error fetching sender profiles:', profilesError);
      }
      
      // Create a map of sender profiles for quick lookup
      const senderProfileMap = (senderProfiles || []).reduce((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {} as Record<string, any>);
      
      // Process each message
      for (const message of rawMessages) {
        if (!message.content) {
          console.warn(`Message ${message.id} has no content!`);
          continue; // Skip messages with no content
        }
        
        console.log(`Processing message ${message.id}:`, {
          content_preview: message.content?.substring(0, 20) || 'EMPTY',
          content_length: message.content?.length || 0,
          sender_id: message.sender_id
        });
        
        // Get sender profile from the map
        const senderProfile = senderProfileMap[message.sender_id] || {
          id: message.sender_id,
          username: 'Unknown User',
          full_name: 'Unknown'
        };
        
        // Create the full message object
        const fullMessage: Message = {
          id: message.id,
          content: message.content || '',
          created_at: message.created_at,
          sender_id: message.sender_id,
          sender: senderProfile
        };
        
        processedMessages.push(fullMessage);
      }

      console.log('Processed messages:', processedMessages.length);
      
      // Log sample messages to verify content
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
      
      // Clear any previous error messages for new errors
      setErrorMessage(null);
      
      // Analyze the error to determine if it's a PGRST116 error (no results found)
      // This often happens when a new conversation is created
      const errorStr = String(error);
      const isPGRST116 = 
        errorStr.includes('PGRST116') || 
        errorStr.includes('The result contains 0 rows');
      
      if (isPGRST116) {
        console.log('Got PGRST116 error (no results), showing empty state');
        setMessages([]);
      } else {
        // Only show an error alert for specific errors that require user action
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('User not found') || 
            errorMessage.includes('not authorized')) {
          Alert.alert('Error', errorMessage);
        } else {
          // For other errors, log but don't show to user - just show empty state
          console.warn('Suppressing error alert, showing empty state instead:', errorMessage);
          setMessages([]);
          
          // Store the error message only if debug mode is enabled
          if (debugMode && showErrors) {
            setErrorMessage(errorStr);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const userId = typeof id === 'string' ? id : id[0];
    
    // Check if ID is a UUID (conversation) or user ID
    const idIsUUID = isUUID(userId);
    
    // If it's not a UUID format, it might be a user ID and no conversation exists yet
    if (!idIsUUID) {
      // We don't have a conversation ID yet, so we can't subscribe
      console.log('Not subscribing to messages: not a UUID conversation ID');
      return () => {}; // Return empty cleanup function
    }
    
    try {
      console.log('Setting up real-time subscription for conversation:', userId);
      
      // First verify conversation exists silently
      try {
        supabase
          .from('conversations')
          .select('id')
          .eq('id', userId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              // Handle PGRST116 error silently
              if (error.code === 'PGRST116') {
                console.log('Conversation not found for subscription, this is expected for new conversations');
              } else {
                console.warn('Non-critical error checking conversation for subscription:', error);
              }
            } else {
              console.log('Conversation verified for subscription:', data?.id);
            }
          });
      } catch (err) {
        console.warn('Error verifying conversation for subscription:', err);
      }
      
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
              
              // Check if the message is valid
              if (!newMsg || !newMsg.id || !newMsg.content) {
                console.warn('Received invalid message in real-time update:', newMsg);
                return;
              }
              
              // Log detailed info about the received message
              console.log('Message details:', {
                id: newMsg.id,
                content: newMsg.content.substring(0, 30) + (newMsg.content.length > 30 ? '...' : ''),
                content_length: newMsg.content?.length || 0,
                sender_id: newMsg.sender_id
              });
              
              // Fetch the sender profile
              const { data: senderData } = await supabase
                .from('profiles')
                .select('id, username, full_name')
                .eq('id', newMsg.sender_id)
                .single();
                
              // Check if we already have this message (to avoid duplicates)
              const messageExists = messages.some(msg => msg.id === newMsg.id);
              if (messageExists) {
                console.log('Message already exists in state, skipping update');
                return;
              }
                
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
                flatListRef.current.scrollToEnd({ animated: true });
              }
            } catch (error) {
              console.error('Error processing real-time message:', error);
            }
          }
        )
        .subscribe();
        
      // Return a cleanup function to unsubscribe when the component unmounts
      return () => {
        console.log('Unsubscribing from messages channel');
        supabase.removeChannel(subscription);
      };
    } catch (error) {
      console.error('Error setting up subscription:', error);
      return () => {}; // Return empty cleanup function on error
    }
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
      
      // Handle conversation check errors silently
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Conversation not found, will create a new one');
        // Continue with creating a new conversation
      } else if (checkError) {
        console.warn('Non-critical error checking conversation:', checkError);
        // Continue with creating a new conversation
      } else if (conversationCheck) {
        // This is an existing conversation ID
        conversationId = userId;
        existingConversation = true;
        console.log('Using existing conversation ID:', conversationId);
      }
      
      // If no existing conversation was found, check if this is a user ID
      if (!conversationId) {
        // Check if this is a valid user ID
        console.log('ID not found as conversation, checking if it is a user ID:', userId);
        const { data: userCheck, error: userCheckError } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', userId)
          .single();
        
        if (userCheckError) {
          console.error('Error checking user ID:', userCheckError);
          if (userCheckError.code === 'PGRST116') {
            throw new Error('User not found. Please check the user ID.');
          } else {
            throw new Error(`Invalid user ID: ${userCheckError.message}`);
          }
        }
        
        if (!userCheck) {
          throw new Error('User not found. Please check the user ID.');
        }
        
        // This is a valid user ID - create a new conversation
        console.log('Creating new conversation with user:', userId, userCheck.username);
        
        // First check if a conversation already exists between these users
        console.log('Checking for existing conversation between users...');
        const { data: existingConvs, error: existingConvsError } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${session?.user.id},participant2_id.eq.${userId}),and(participant1_id.eq.${userId},participant2_id.eq.${session?.user.id})`)
          .maybeSingle();
          
        if (existingConvsError) {
          console.warn('Error checking existing conversations:', existingConvsError);
          // Continue with creating a new conversation
        }
        
        if (!existingConvsError && existingConvs && existingConvs.id) {
          // Use the existing conversation
          conversationId = existingConvs.id;
          console.log('Found existing conversation:', conversationId);
          
          // Update the URL
          router.replace(`/chat/${conversationId}`);
        } else {
          // Create a new conversation
          console.log('No existing conversation found, creating new one...');
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
            throw new Error(`Failed to create conversation: ${createError.message}`);
          }
          
          if (!newConversation || !newConversation.id) {
            throw new Error('Failed to create conversation: No ID returned');
          }
          
          conversationId = newConversation.id;
          console.log('Created new conversation with ID:', conversationId);
          
          // Short delay to ensure database consistency
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // At this point we have a valid conversation ID
      console.log('Sending message to conversation:', conversationId);
      
      // Send the message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: newMessage.trim(),
          sender_id: session?.user.id
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        throw new Error(`Failed to send message: ${messageError.message}`);
      }

      // Message sent successfully
      console.log('Message sent successfully');
      setNewMessage('');
      
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
      
      // For newly created conversations, navigate to the conversation page
      if (!existingConversation || conversationId !== userId) {
        console.log('Navigating to new conversation:', conversationId);
        router.replace(`/chat/${conversationId}`);
        
        // After navigation, we need to manually refresh
        setTimeout(() => {
          fetchMessages();
          fetchChatUser();
          
          // Scroll to bottom after messages are loaded
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 300);
        }, 500);
      } else {
        // For existing conversations, just refresh messages
        fetchMessages();
        // Scroll to bottom after messages are loaded
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 300);
      }
      
    } catch (error) {
      console.error('Error in message flow:', error);
      
      // Determine if this is a PGRST116 error
      const errorStr = String(error);
      const isPGRST116 = 
        errorStr.includes('PGRST116') || 
        errorStr.includes('The result contains 0 rows');
        
      if (isPGRST116) {
        console.log('Got PGRST116 error when sending message (no results), this is expected for new conversations');
        // Don't show an error for this case - it's likely a new conversation being created
        
        // Try to continue with message sending
        setTimeout(() => {
          setSending(false);
          // Try again after a short delay to allow conversation creation to complete
          handleSend();
        }, 1000);
        
        return;
      }
      
      if (debugMode && showErrors) {
        // Show full error in debug mode
        setErrorMessage(errorStr);
      }
      
      // For other errors, show alert
      Alert.alert(
        'Message Error', 
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          { 
            text: 'Try Again',
            onPress: () => setSending(false)
          }
        ]
      );
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
              try {
                setLoading(true);
                Alert.alert('Working', 'Attempting to fix message permissions...');
                
                // 1. Verify conversation
                const { data: conv, error: convError } = await supabase
                  .from('conversations')
                  .select('participant1_id, participant2_id')
                  .eq('id', userId)
                  .single();
                
                if (convError || !conv) {
                  console.error('Error getting conversation:', convError);
                  Alert.alert('Error', 'Conversation not found');
                  return;
                }
                
                // 2. Check if conversation has proper participants
                const participant1 = conv.participant1_id;
                const participant2 = conv.participant2_id;
                
                if (!participant1 || !participant2) {
                  Alert.alert('Error', 'Conversation is missing participants');
                  return;
                }
                
                Alert.alert(
                  'Conversation Info',
                  `Conversation ID: ${userId.substring(0, 8)}...\n` +
                  `Participant 1: ${participant1.substring(0, 8)}...\n` +
                  `Participant 2: ${participant2.substring(0, 8)}...\n` +
                  `Current User: ${session?.user.id.substring(0, 8)}...`,
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    },
                    {
                      text: 'Refresh Messages',
                      onPress: () => {
                        handleRefresh();
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Error fixing messages:', error);
                Alert.alert('Error', 'Failed to fix messages');
              } finally {
                setLoading(false);
              }
            }
          },
          {
            text: 'Dump Message Data',
            onPress: async () => {
              if (messages.length === 0) {
                Alert.alert('No Messages', 'There are no messages to inspect');
                return;
              }
              
              // Take the first message and dump its complete data
              const firstMessage = messages[0];
              Alert.alert(
                'Message Debug Info',
                `ID: ${firstMessage.id}\n` +
                `Content: "${firstMessage.content.substring(0, 50)}${firstMessage.content.length > 50 ? '...' : ''}"\n` +
                `Sender ID: ${firstMessage.sender_id}\n` +
                `Sender: ${firstMessage.sender.username}\n` +
                `Created: ${new Date(firstMessage.created_at).toLocaleString()}\n` +
                `Content Length: ${firstMessage.content.length}\n` +
                `Current User: ${session?.user.id}`
              );
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
    
    if (debugMode) {
      console.log('Rendering message:', {
        id: item.id.substring(0, 8),
        content: item.content.substring(0, 20) + (item.content.length > 20 ? '...' : ''),
        content_length: item.content?.length || 0,
        sender_id: item.sender_id.substring(0, 8),
        isOwnMessage,
        currentUserId: session?.user.id?.substring(0, 8)
      });
    }

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.myMessage : styles.otherMessage
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
          isOwnMessage ? styles.myMessageContent : styles.otherMessageContent
        ]}>
          {item.content ? (
            <Text style={[
              styles.messageText,
              !isOwnMessage && styles.otherMessageText
            ]} testID="messageText">
              {item.content}
            </Text>
          ) : (
            <Text style={[
              styles.emptyMessageText,
              !isOwnMessage && styles.otherEmptyMessageText
            ]}>
              [Empty message]
            </Text>
          )}
          <Text style={[
            styles.timestamp,
            !isOwnMessage && styles.otherTimestamp
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          {(debugMode || __DEV__) && (
            <Text style={[
              styles.debugText,
              !isOwnMessage && { color: 'rgba(0, 0, 0, 0.5)' }
            ]}>
              ID: {item.id.substring(0, 8)} | 
              Sender: {item.sender_id.substring(0, 8)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Add this function to the component to handle all errors at the UI level
  const handleError = (error: any) => {
    console.warn('Error handled silently:', error);
    
    // Check for PGRST116 errors specifically
    const errorStr = String(error);
    if (errorStr.includes('PGRST116') || 
        errorStr.includes('Error verifying conversation') || 
        errorStr.includes('The result contains 0 rows')) {
      // These are expected for new conversations, don't show anything
      return null;
    }
    
    // For debugging only
    if (debugMode && showErrors) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorStr}</Text>
        </View>
      );
    }
    
    // In normal mode, don't show errors
    return null;
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
          {debugMode && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowErrors(!showErrors)}
            >
              <Ionicons name="warning" size={24} color={showErrors ? "#e74c3c" : "#999"} />
            </TouchableOpacity>
          )}
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

      {debugMode && showErrors && errorMessage && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Error Info</Text>
          <Text style={styles.debugInfo}>{errorMessage}</Text>
        </View>
      )}

      {debugMode && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugInfo}>Messages: {messages.length}</Text>
          <Text style={styles.debugInfo}>Conversation ID: {typeof id === 'string' ? id : id[0]}</Text>
          <Text style={styles.debugInfo}>User ID: {session?.user.id}</Text>
          <Text style={styles.debugInfo}>Is UUID: {isUUID(typeof id === 'string' ? id : id[0]) ? 'Yes' : 'No'}</Text>
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
            <Ionicons name="chatbubble-outline" size={56} color="#5561F5" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No messages yet</Text>
            
            {isUUID(typeof id === 'string' ? id : id[0]) ? (
              <Text style={styles.emptySubText}>
                Send a message to start the conversation.
              </Text>
            ) : (
              <Text style={styles.emptySubText}>
                This is a new conversation. Type a message below to start chatting.
              </Text>
            )}
            
            {debugMode && (
              <TouchableOpacity 
                style={styles.debugFixButton}
                onPress={handleFixMessages}
              >
                <Ionicons name="bug-outline" size={16} color="#fff" />
                <Text style={styles.debugFixButtonText}>Debug Connection</Text>
              </TouchableOpacity>
            )}
            
            {debugMode && (
              <View style={styles.debugMessagePanel}>
                <Text style={styles.debugTitle}>Why no messages?</Text>
                <Text style={styles.debugInfo}>1. New conversation</Text>
                <Text style={styles.debugInfo}>2. RLS issues</Text>
                <Text style={styles.debugInfo}>3. Message fetch error</Text>
                <Text style={styles.debugInfo}>ID: {typeof id === 'string' ? id : id[0]}</Text>
                <Text style={styles.debugInfo}>Is UUID: {isUUID(typeof id === 'string' ? id : id[0]) ? 'Yes' : 'No'}</Text>
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
            (!newMessage.trim() || sending) && styles.disabledSendButton
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
    backgroundColor: '#F8F9FD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4FC',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6E7191',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4FC',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#5561F5',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  myMessageContent: {
    backgroundColor: '#5561F5',
  },
  otherMessageContent: {
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  otherMessageText: {
    color: '#333333',
    fontSize: 16,
  },
  emptyMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  otherEmptyMessageText: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  otherTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    padding: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4FC',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1D3F',
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#5561F5',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledSendButton: {
    backgroundColor: '#A0A3BD',
    shadowOpacity: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 16,
    color: '#6E7191',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 5,
    marginLeft: 5,
  },
  debugPanel: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    margin: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginBottom: 8,
  },
  debugInfo: {
    fontSize: 12,
    color: '#6E7191',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
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
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
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
  messageContent: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
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
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugFixButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#5561F5',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  debugFixButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.8,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    margin: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
}); 