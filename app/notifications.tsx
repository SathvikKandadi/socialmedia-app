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

// Add declaration for global event handler
declare global {
  var updateNotificationBadges: ((count?: number) => void) | undefined;
}

type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request';
  created_at: string;
  read: boolean;
  actor: {
    id: string;
    username: string;
    full_name: string;
  };
  post?: {
    id: string;
    content: string;
    user_id?: string;
  } | null;
};

export default function Notifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
    
    // Immediately set notification count to 0 in home screen
    // This ensures badge disappears right away, even before DB update completes
    if (global.updateNotificationBadges) {
      // Force count to 0 immediately - this should fix the badge issue
      global.updateNotificationBadges(0);
      
      // Safely store the function reference
      const updateBadges = global.updateNotificationBadges;
      // Also schedule another update after a delay to ensure it sticks
      setTimeout(() => {
        if (updateBadges) {
          updateBadges(0);
        }
      }, 500);
    }
    
    // Mark notifications as read immediately when the screen is opened
    markAllAsRead();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      // Debug: First check how many unread notifications exist
      const { data: unreadCheck, error: checkError } = await supabase
        .from('notifications')
        .select('id, read')
        .eq('recipient_id', session?.user.id)
        .eq('read', false);
        
      console.log(`Debug - Found ${unreadCheck?.length || 0} unread notifications before fetch`);
      if (unreadCheck && unreadCheck.length > 0) {
        console.log('Unread notification IDs:', unreadCheck.map(n => n.id).join(', '));
      }

      // Fetch basic notifications data
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, type, created_at, read, user_id, post_id')
        .eq('recipient_id', session?.user.id)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // Process each notification to include actor and post data
      const processedNotifications: Notification[] = [];
      
      for (const notification of notificationsData || []) {
        // For this implementation, we'll use a placeholder for actor since actor_id doesn't exist
        let actor = { id: 'unknown', username: 'A user', full_name: 'Unknown User' };
        
        // Fetch post data if available
        let post = null;
        if (notification.post_id) {
          const { data: postData } = await supabase
            .from('posts')
            .select('id, content, user_id')
            .eq('id', notification.post_id)
            .single();
            
          if (postData) {
            post = {
              id: postData.id,
              content: postData.content,
              user_id: postData.user_id
            };
            
            // Get the post creator's info to use as the actor
            const { data: posterData } = await supabase
              .from('profiles')
              .select('id, username, full_name')
              .eq('id', postData.user_id)
              .single();
              
            if (posterData) {
              actor = posterData;
            }
          }
        }
        
        processedNotifications.push({
          id: notification.id,
          type: notification.type as 'like' | 'comment' | 'follow' | 'follow_request',
          created_at: notification.created_at,
          read: notification.read,
          actor,
          post
        });
      }

      setNotifications(processedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    try {
      // First check which notifications need to be marked as read
      const { data: unreadNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', session?.user.id)
        .eq('read', false);
        
      if (fetchError) {
        console.error('Error fetching unread notifications:', fetchError);
        return;
      }
      
      if (!unreadNotifications || unreadNotifications.length === 0) {
        console.log('No unread notifications found');
        return; // No unread notifications
      }
      
      console.log(`Marking ${unreadNotifications.length} notifications as read`);
      console.log('Notification IDs to mark as read:', unreadNotifications.map(n => n.id).join(', '));
      
      // Try first approach - update all unread notifications
      const { error: batchError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', session?.user.id)
        .eq('read', false);

      if (batchError) {
        console.error('Error with batch update:', batchError);
        
        // If batch update fails, try updating each notification individually
        console.log('Attempting individual updates...');
        for (const notification of unreadNotifications) {
          const { error: individualError } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notification.id);
            
          if (individualError) {
            console.error(`Failed to update notification ${notification.id}:`, individualError);
          } else {
            console.log(`Successfully marked notification ${notification.id} as read`);
          }
        }
      } else {
        console.log('Successfully marked all notifications as read with batch update');
      }

      // Verify the update worked
      const { data: checkResult } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', session?.user.id)
        .eq('read', false);
        
      if (checkResult && checkResult.length > 0) {
        console.warn(`Warning: ${checkResult.length} notifications still unread after update`);
      } else {
        console.log('Verification success: All notifications are now marked as read');
      }

      // Update state to reflect changes
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      
      // Force notification count update in the home screen with explicit 0 count
      // This ensures it's definitely set to 0 after DB update
      try {
        if (global.updateNotificationBadges) {
          global.updateNotificationBadges(0);
          
          // Schedule another update to ensure it sticks
          const updateBadges = global.updateNotificationBadges;
          setTimeout(() => {
            if (updateBadges) {
              updateBadges(0);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Error triggering badge update:', err);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      console.log('Marking notification as read:', notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Database error marking notification as read:', error);
        throw error;
      }

      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      
      console.log('Notification marked as read successfully');
      
      // Count remaining unread notifications after this one is marked as read
      const remainingUnread = notifications.filter(n => 
        n.id !== notificationId && !n.read
      ).length;
      
      // Also update the notification badge count in the home screen
      if (global.updateNotificationBadges) {
        global.updateNotificationBadges(remainingUnread);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'followed you';
      case 'follow_request':
        return 'sent you a follow request';
      default:
        return '';
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Always mark the notification as read
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'like' || notification.type === 'comment') {
      if (notification.post && notification.post.id) {
        // Navigate to the post
        router.push({
          pathname: '/comments/[id]',
          params: { id: notification.post.id }
        });
      }
    } else if (notification.type === 'follow') {
      // Navigate to the follower's profile
      if (notification.actor && notification.actor.id) {
        // For user profiles, we'll just go back to the main profile for now
        // since we might not have the correct route structure
        router.push('/profile');
      }
    } else if (notification.type === 'follow_request') {
      // Navigate to follow requests screen
      router.push('/follow-requests');
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[
        styles.notificationContainer,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.actor.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.textContainer}>
            <Text style={styles.username}>{item.actor.username}</Text>
            <Text style={styles.actionText}>
              {getNotificationText(item)}
            </Text>
          </View>
          {item.post && (
            <Text style={styles.postPreview} numberOfLines={2}>
              {item.post.content}
            </Text>
          )}
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#306998" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            console.log('Manual notification fix initiated');
            markAllAsRead();
            // Force refresh of the home screen badge
            if (global.updateNotificationBadges) {
              global.updateNotificationBadges(0);
            }
            Alert.alert('Notification Fix', 'Forced notification badge reset');
          }}
        >
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notificationsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#306998']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications</Text>
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
  refreshButton: {
    padding: 5,
  },
  notificationsList: {
    padding: 10,
  },
  notificationContainer: {
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
  unreadNotification: {
    backgroundColor: '#f0f7ff',
  },
  userInfo: {
    flexDirection: 'row',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#306998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 5,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
  },
  postPreview: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
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