-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create posts table
CREATE TABLE posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create comments table
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create likes table
CREATE TABLE likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Create followers table
CREATE TABLE followers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- Create conversations table
CREATE TABLE conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  participant2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(participant1_id, participant2_id)
);

-- Create messages table
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'follow_request')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CHECK (
    (type IN ('like', 'comment') AND post_id IS NOT NULL) OR
    (type IN ('follow', 'follow_request') AND post_id IS NULL AND comment_id IS NULL)
  )
);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_followers_updated_at
  BEFORE UPDATE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to update conversation last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message = NEW.content,
      last_message_time = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating conversation last message
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Create function to create notification
CREATE OR REPLACE FUNCTION create_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
    IF NEW.post_id IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, user_id, type, post_id)
      SELECT p.user_id, NEW.user_id, 'like', NEW.post_id
      FROM posts p
      WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
    ELSE
      INSERT INTO notifications (recipient_id, user_id, type, comment_id)
      SELECT c.user_id, NEW.user_id, 'like', NEW.comment_id
      FROM comments c
      WHERE c.id = NEW.comment_id AND c.user_id != NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    INSERT INTO notifications (recipient_id, user_id, type, post_id)
    SELECT p.user_id, NEW.user_id, 'comment', NEW.post_id
    FROM posts p
    WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  ELSIF TG_TABLE_NAME = 'followers' THEN
    IF NEW.status = 'pending' THEN
      INSERT INTO notifications (recipient_id, user_id, type)
      VALUES (NEW.following_id, NEW.follower_id, 'follow_request');
    ELSIF NEW.status = 'accepted' THEN
      INSERT INTO notifications (recipient_id, user_id, type)
      VALUES (NEW.follower_id, NEW.following_id, 'follow');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for notifications
CREATE TRIGGER create_like_notification
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION create_notification();

CREATE TRIGGER create_comment_notification
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_notification();

CREATE TRIGGER create_follow_notification
  AFTER INSERT OR UPDATE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION create_notification();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create likes"
  ON likes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Followers are viewable by everyone"
  ON followers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create follow requests"
  ON followers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own follow requests"
  ON followers FOR UPDATE
  USING (auth.uid() = following_id);

CREATE POLICY "Users can delete their own follow requests"
  ON followers FOR DELETE
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Conversations are viewable by participants"
  ON conversations FOR SELECT
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- First, make sure RLS is enabled on the messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Delete any existing RLS policies on the messages table to avoid conflicts
DROP POLICY IF EXISTS "Messages are viewable by conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Messages can be inserted by conversation participants" ON public.messages;

-- Create policy for viewing messages
-- This allows users to view any message where they are part of the conversation
CREATE POLICY "Messages are viewable by conversation participants" ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
  )
);

-- Create policy for inserting messages
-- This allows users to insert messages only to conversations they are part of
CREATE POLICY "Messages can be inserted by conversation participants" ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
  )
);

-- Create policy for updating messages
-- This allows users to update only their own messages
CREATE POLICY "Users can update own messages" ON public.messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Create policy for deleting messages
-- This allows users to delete only their own messages
CREATE POLICY "Users can delete own messages" ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

CREATE POLICY "Notifications are viewable by recipient"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id);

-- First, make sure RLS is enabled on the notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create the insert policy if it doesn't exist yet
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Allow users to create notifications'
    ) THEN
        CREATE POLICY "Allow users to create notifications" 
        ON public.notifications
        FOR INSERT 
        TO authenticated
        WITH CHECK (true);
    END IF;
END
$$;

-- Skip the update policy since it already exists
-- The error indicates "Users can update their own notifications" is already defined

-- Create the select policy if it doesn't exist yet
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications" 
        ON public.notifications 
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Make sure the INSERT permission is granted
GRANT INSERT ON public.notifications TO authenticated;

-- Create indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_comment_id ON likes(comment_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_followers_follower_id ON followers(follower_id);
CREATE INDEX idx_followers_following_id ON followers(following_id);
CREATE INDEX idx_conversations_participant1_id ON conversations(participant1_id);
CREATE INDEX idx_conversations_participant2_id ON conversations(participant2_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_post_id ON notifications(post_id);
CREATE INDEX idx_notifications_comment_id ON notifications(comment_id); 