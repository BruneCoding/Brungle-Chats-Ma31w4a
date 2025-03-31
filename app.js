// Firebase configuration (replace with your own)

console.log("Testv2")
const firebaseConfig = {
  apiKey: "AIzaSyBs2SQXVuM65VCIv54zy8ScDQODXu2f1kM",
  authDomain: "simple-chatting-test.firebaseapp.com",
  projectId: "simple-chatting-test",
  storageBucket: "simple-chatting-test.firebasestorage.app",
  messagingSenderId: "601862347824",
  appId: "1:601862347824:web:e713904cc35bafd1a521f5",
  measurementId: "G-BG9X4MPW5H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const signupBtn = document.getElementById('signup-btn');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const logoutBtn = document.getElementById('logout-btn');
const currentUsername = document.getElementById('current-username');
const contactsList = document.getElementById('contacts');
const groupsList = document.getElementById('groups');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const globalChatBtn = document.getElementById('global-chat-btn');
const createGroupBtn = document.getElementById('create-group-btn');
const createGroupForm = document.getElementById('create-group-form');
const groupNameInput = document.getElementById('group-name');
const groupMembersInput = document.getElementById('group-members');
const createGroupSubmit = document.getElementById('create-group-submit');
const currentChatName = document.getElementById('current-chat-name');

// App state
let currentUser = null;
let currentChat = {
    type: 'global', // 'global', 'private', 'group'
    id: 'global',
    name: 'Global Chat'
};
let users = [];
let groups = [];

// Initialize the app
init();

function init() {
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            currentUser = user;
            setupChatApp();
        } else {
            // No user signed in
            showAuthScreen();
        }
    });

    // Event listeners
    signupBtn.addEventListener('click', handleSignup);
    logoutBtn.addEventListener('click', handleLogout);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    globalChatBtn.addEventListener('click', () => switchChat('global', 'Global Chat'));
    createGroupBtn.addEventListener('click', toggleCreateGroupForm);
    createGroupSubmit.addEventListener('click', createGroup);
}

function showAuthScreen() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
}

function showChatScreen() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
}

async function handleSignup() {
    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value;

    if (!email || !password || !username) {
        alert('Please fill all fields');
        return;
    }

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Save additional user info to Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            username: username,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentUser = userCredential.user;
        setupChatApp();
    } catch (error) {
        // If user exists, try to sign in
        if (error.code === 'auth/email-already-in-use') {
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                currentUser = userCredential.user;
                setupChatApp();
            } catch (signInError) {
                alert(signInError.message);
            }
        } else {
            alert(error.message);
        }
    }
}

async function setupChatApp() {
    showChatScreen();
    currentUsername.textContent = await getUsername(currentUser.uid);
    
    // Load users and groups
    loadUsers();
    loadGroups();
    
    // Set up current chat
    switchChat(currentChat.type, currentChat.id);
    
    // Set up real-time listeners
    setupMessageListener();
  
}

async function getUsername(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? doc.data().username : 'Unknown';
}

function handleLogout() {
    auth.signOut();
}

async function loadUsers() {
    db.collection('users').onSnapshot(snapshot => {
        users = [];
        contactsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) { // Don't show current user in contacts
                const user = {
                    id: doc.id,
                    ...doc.data()
                };
                users.push(user);
                
                // Add to contacts list
                const li = document.createElement('li');
                li.textContent = user.username;
                li.dataset.userId = user.id;
                li.addEventListener('click', () => {
                    switchChat('private', user.id, user.username);
                });
                contactsList.appendChild(li);
            }
        });
    });
}

async function loadGroups() {
    // Groups where current user is a member
    db.collection('groups').where('members', 'array-contains', currentUser.uid).onSnapshot(snapshot => {
            groups = [];
            groupsList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const group = {
                    id: doc.id,
                    ...doc.data()
                };
                groups.push(group);
                
                // Add to groups list
                const li = document.createElement('li');
                li.textContent = group.name;
                li.dataset.groupId = group.id;
                li.addEventListener('click', () => {
                    switchChat('group', group.id, group.name);
                });
                groupsList.appendChild(li);
            });
        });
}

function toggleCreateGroupForm() {
    createGroupForm.classList.toggle('hidden');
}

async function createGroup() {
    const groupName = groupNameInput.value;
    const membersInput = groupMembersInput.value;
    
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    // Get member IDs from usernames
    const memberUsernames = membersInput.split(',').map(u => u.trim()).filter(u => u);
    const memberIds = [];
    
    for (const username of memberUsernames) {
        const user = users.find(u => u.username === username);
        if (user) {
            memberIds.push(user.id);
        }
    }
    
    if (memberIds.length > 10) {
        alert('Maximum 10 members per group');
        return;
    }
    
    // Add current user to members
    if (!memberIds.includes(currentUser.uid)) {
        memberIds.push(currentUser.uid);
    }
    
    try {
        await db.collection('groups').add({
            name: groupName,
            members: memberIds,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Clear form
        groupNameInput.value = '';
        groupMembersInput.value = '';
        createGroupForm.classList.add('hidden');
    } catch (error) {
        alert('Error creating group: ' + error.message);
    }
}

function switchChat(type, id, name = null) {
    currentChat = { type, id, name: name || id };
    currentChatName.textContent = name || id;
    
    // Update UI
    globalChatBtn.classList.remove('active');
    if (type === 'global') {
        globalChatBtn.classList.add('active');
    }
    
    // Clear messages
    messagesContainer.innerHTML = '';
    
    // Load messages for this chat
    loadMessages();
}

function loadMessages() {
    // Clear previous listener if any
    if (window.messageListener) {
        window.messageListener();
    }
    
    let messagesQuery;
    
    if (currentChat.type === 'global') {
        messagesQuery = db.collection('messages')
            .where('chatType', '==', 'global')
            .orderBy('timestamp', 'desc')
            .limit(100);
    } else if (currentChat.type === 'private') {
        // Private chat between two users - order is always the same
        const chatId = [currentUser.uid, currentChat.id].sort().join('_');
        
        messagesQuery = db.collection('messages')
            .where('chatId', '==', chatId)
            .orderBy('timestamp', 'desc')
            .limit(100);
    } else if (currentChat.type === 'group') {
        messagesQuery = db.collection('messages')
            .where('chatId', '==', currentChat.id)
            .orderBy('timestamp', 'desc')
            .limit(100);
    }
    
    window.messageListener = messagesQuery.onSnapshot(snapshot => {
        messagesContainer.innerHTML = '';
        
        const messages = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Display in chronological order
        messages.reverse().forEach(message => {
            displayMessage(message);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (message.senderId === currentUser.uid) {
        messageDiv.classList.add('sent');
    }
    
    const messageInfo = document.createElement('div');
    messageInfo.classList.add('message-info');
    
    // Get username from users array or fetch it
    const sender = users.find(u => u.id === message.senderId) || { username: 'Loading...' };
    
    messageInfo.textContent = `${sender.username} - ${new Date(message.timestamp?.toDate()).toLocaleString()}`;
    messageDiv.appendChild(messageInfo);
    
    const messageText = document.createElement('div');
    messageText.textContent = message.text;
    messageDiv.appendChild(messageText);
    
    messagesContainer.appendChild(messageDiv);
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    
    let messageData = {
        text,
        senderId: currentUser.uid,
        senderUsername: await getUsername(currentUser.uid),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (currentChat.type === 'global') {
        messageData.chatType = 'global';
    } else if (currentChat.type === 'private') {
        messageData.chatType = 'private';
        messageData.chatId = [currentUser.uid, currentChat.id].sort().join('_');
        messageData.participants = [currentUser.uid, currentChat.id];
    } else if (currentChat.type === 'group') {
        messageData.chatType = 'group';
        messageData.chatId = currentChat.id;
    }
    
    try {
        await db.collection('messages').add(messageData);
        messageInput.value = '';
    } catch (error) {
        alert('Error sending message: ' + error.message);
    }
}

function setupMessageListener() {
  // 1. Build the query based on chat type
  let query;
  if (currentChat.type === 'global') {
    query = db.collection('messages')
      .where('chatType', '==', 'global')
      .orderBy('timestamp', 'asc');
  } else if (currentChat.type === 'private') {
    const chatId = [currentUser.uid, currentChat.id].sort().join('_');
    query = db.collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('timestamp', 'asc');
  } else if (currentChat.type === 'group') {
    query = db.collection('messages')
      .where('chatId', '==', currentChat.id)
      .orderBy('timestamp', 'asc');
  }

  // 2. Attach the listener with proper error handling
  return query.onSnapshot((snapshot) => { // <- 'snapshot' is now defined
    console.log("New messages received:", snapshot.docs.map(doc => doc.data()));
    
    // Clear and rebuild the UI
    messagesContainer.innerHTML = '';
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const msgElement = document.createElement('div');
      msgElement.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
      msgElement.innerHTML = `
        <div class="message-info">
          ${msg.senderUsername} • ${msg.timestamp?.toDate().toLocaleTimeString()}
        </div>
        <div class="message-text">${msg.text}</div>
      `;
      messagesContainer.appendChild(msgElement);
    });
  }, (error) => {
    console.error("Listener error:", error); // Log errors
  });
}
