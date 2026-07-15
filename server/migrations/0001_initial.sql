CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar TEXT,
  lastSeen TEXT,
  lastUsernameChange TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  displayName TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('DM','GROUP')),
  title TEXT,
  avatar TEXT,
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  convId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
  muted INTEGER NOT NULL DEFAULT 0,
  joinedAt TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  convId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','image','video','audio','file')),
  content TEXT NOT NULL,
  metadata TEXT,
  timestamp TEXT NOT NULL,
  editedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image','video','audio','file')),
  url TEXT NOT NULL,
  size INTEGER NOT NULL,
  duration INTEGER,
  createdAt TEXT NOT NULL
);

CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  media TEXT NOT NULL,
  caption TEXT,
  expiresAt TEXT NOT NULL,
  viewers TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_contacts_user ON contacts(userId);
CREATE INDEX idx_participants_conv ON participants(convId);
CREATE INDEX idx_messages_conv ON messages(convId, timestamp DESC);
CREATE INDEX idx_media_user ON media(userId);
CREATE INDEX idx_stories_user ON stories(userId);
