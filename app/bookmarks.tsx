import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  FlatList,
  SafeAreaView,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Define types for our data
type Post = {
  id: string;
  content: string;
  username: string;
  timestamp: string;
  likes: number;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type InterestCategory = {
  title: string;
  icon: IconName;
  count: number;
  posts: Post[];
};

// Mock data for the saved posts
const MOCK_POSTS: Post[] = [
  {
    id: '1',
    content: 'The latest advancements in artificial intelligence are truly remarkable. Deep learning models are getting better every day!',
    username: 'airesearcher',
    timestamp: '2 days ago',
    likes: 42
  },
  {
    id: '2',
    content: 'Just finished building my first React Native app. The cross-platform capabilities are amazing!',
    username: 'mobiledev',
    timestamp: '5 days ago',
    likes: 28
  },
  {
    id: '3',
    content: 'Design systems are crucial for maintaining consistency across large-scale applications.',
    username: 'uxdesigner',
    timestamp: '1 week ago',
    likes: 36
  },
];

// Mock data for interests categories
const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    title: 'Programming',
    icon: 'code-slash',
    count: 12,
    posts: MOCK_POSTS
  },
  {
    title: 'AI/ML',
    icon: 'hardware-chip',
    count: 8,
    posts: MOCK_POSTS.slice(0, 2)
  },
  {
    title: 'Design',
    icon: 'color-palette',
    count: 5,
    posts: MOCK_POSTS.slice(1, 3)
  },
  {
    title: 'Web Development',
    icon: 'globe',
    count: 9,
    posts: MOCK_POSTS.slice(0, 1)
  },
  {
    title: 'Mobile Apps',
    icon: 'phone-portrait',
    count: 7,
    posts: MOCK_POSTS.slice(1, 2)
  },
  {
    title: 'Cybersecurity',
    icon: 'shield',
    count: 4,
    posts: MOCK_POSTS.slice(0, 3)
  },
];

export default function Bookmarks() {
  const [selectedInterest, setSelectedInterest] = React.useState<string | null>(null);
  
  const renderInterestCategory = ({ item }: { item: InterestCategory }) => (
    <TouchableOpacity 
      style={[
        styles.categoryCard,
        selectedInterest === item.title && styles.selectedCategoryCard
      ]}
      onPress={() => setSelectedInterest(selectedInterest === item.title ? null : item.title)}
    >
      <View style={styles.categoryIconContainer}>
        <Ionicons name={item.icon} size={24} color="#5561F5" />
      </View>
      <Text style={styles.categoryTitle}>{item.title}</Text>
      <Text style={styles.categoryCount}>{item.count} posts</Text>
    </TouchableOpacity>
  );

  const renderSavedPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </View>
      
      <Text style={styles.postContent}>{item.content}</Text>
      
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={18} color="#FF6B6B" />
          <Text style={styles.postStatText}>{item.likes}</Text>
        </View>
        <TouchableOpacity style={styles.postAction}>
          <Ionicons name="bookmark" size={18} color="#5561F5" />
          <Text style={styles.postActionText}>Saved</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const selectedCategory = selectedInterest 
    ? INTEREST_CATEGORIES.find(cat => cat.title === selectedInterest) 
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.push('/home')}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1D3F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="search" size={24} color="#1A1D3F" />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Interest Categories */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <FlatList
            data={INTEREST_CATEGORIES}
            renderItem={renderInterestCategory}
            keyExtractor={item => item.title}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Saved Posts */}
        <View style={styles.postsSection}>
          <View style={styles.postsHeader}>
            <Text style={styles.sectionTitle}>
              {selectedInterest ? `${selectedInterest} Posts` : 'All Saved Posts'}
            </Text>
            <Text style={styles.postsCount}>
              {selectedCategory ? selectedCategory.count : INTEREST_CATEGORIES.reduce((sum, cat) => sum + cat.count, 0)} posts
            </Text>
          </View>
          
          {/* List of posts */}
          {selectedCategory ? (
            selectedCategory.posts.map(post => (
              <React.Fragment key={post.id}>
                {renderSavedPost({ item: post })}
              </React.Fragment>
            ))
          ) : (
            // Show posts from all categories if none selected
            MOCK_POSTS.map(post => (
              <React.Fragment key={post.id}>
                {renderSavedPost({ item: post })}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>

      {/* Navigation Bar (same as home screen) */}
      <View style={styles.navbar}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/home')}
        >
          <Ionicons name="home-outline" size={24} color="#6E7191" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search-outline" size={24} color="#6E7191" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#6E7191" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => router.push('/messages')}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#6E7191" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, styles.activeNavButton]}
        >
          <Ionicons name="bookmark" size={24} color="#5561F5" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesSection: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D3F',
    marginBottom: 12,
  },
  categoriesList: {
    paddingVertical: 8,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCategoryCard: {
    backgroundColor: '#F0F2FF',
    borderWidth: 1,
    borderColor: '#5561F5',
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1D3F',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: '#6E7191',
  },
  postsSection: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Extra padding for the navbar
  },
  postsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  postsCount: {
    fontSize: 14,
    color: '#6E7191',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5561F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D3F',
  },
  timestamp: {
    fontSize: 12,
    color: '#6E7191',
  },
  postContent: {
    fontSize: 14,
    color: '#1A1D3F',
    marginBottom: 12,
    lineHeight: 20,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    paddingTop: 12,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    marginLeft: 6,
    color: '#6E7191',
    fontSize: 14,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postActionText: {
    marginLeft: 6,
    color: '#5561F5',
    fontSize: 14,
    fontWeight: '500',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeNavButton: {
    backgroundColor: '#F0F2FF',
  },
}); 