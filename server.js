const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 7860;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Data storage paths
const usersFile = path.join(__dirname, 'data', 'users.json');
const accountsFile = path.join(__dirname, 'data', 'accounts.json');
const transactionsFile = path.join(__dirname, 'data', 'transactions.json');
const notificationsFile = path.join(__dirname, 'data', 'notifications.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Helper to read JSON files
function readJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
}

// Helper to write JSON files
function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Hash password
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate 10-digit account number
function generateAccountNumber() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Generate transaction ID
function generateTransactionId() {
    return 'TRX' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Generate notification ID
function generateNotificationId() {
    return 'NOT' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Create notification
function createNotification(userId, title, message, type = 'transaction') {
    const notifications = readJSON(notificationsFile);
    
    const notification = {
        notificationId: generateNotificationId(),
        userId,
        title,
        message,
        type,
        isRead: false,
        timestamp: new Date().toISOString()
    };
    
    notifications.push(notification);
    writeJSON(notificationsFile, notifications);
    return notification;
}

// REGISTER API
app.post('/api/register', (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const users = readJSON(usersFile);
        
        // Check if email already exists
        if (users.some(u => u.email === email)) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create new user
        const userId = 'USR' + Date.now().toString();
        const hashedPassword = hashPassword(password);

        const newUser = {
            userId,
            firstName,
            lastName,
            email,
            phone,
            passwordHash: hashedPassword,
            status: 'successful',
            profilePhoto: '',
            createdAt: new Date().toISOString(),
            adminNote: '',
            authVerification: { enabled: false, authName: '', authCode: '' } // Added authVerification to user object
        };

        users.push(newUser);
        writeJSON(usersFile, users);

        // Create 2 default accounts for user with 0 balance
        const accounts = readJSON(accountsFile);
        
        const account1 = {
            accountId: 'ACC' + Date.now().toString(),
            userId,
            accountNumber: generateAccountNumber(),
            accountName: 'Checking Account',
            type: 'checking',
            balance: 0,
            availableBalance: 0,
            currency: 'USD',
            createdAt: new Date().toISOString(),
            status: 'active',
            icon: '💰'
        };

        const account2 = {
            accountId: 'ACC' + (Date.now() + 1).toString(),
            userId,
            accountNumber: generateAccountNumber(),
            accountName: 'Savings Account',
            type: 'savings',
            balance: 0,
            availableBalance: 0,
            currency: 'USD',
            createdAt: new Date().toISOString(),
            status: 'active',
            icon: '💾'
        };

        accounts.push(account1, account2);
        writeJSON(accountsFile, accounts);

        // Generate token (simple JWT-like)
        const token = crypto.randomBytes(32).toString('hex');

        res.status(201).json({
            message: 'Registration successful',
            token,
            userId,
            user: {
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// LOGIN API
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        // ADMIN LOGIN
        if (email === 'admin@bankofAmerica.com' && password === 'admin123') {
            const adminToken = 'admin-token-' + Date.now();
            return res.json({
                message: 'Admin login successful',
                token: adminToken,
                userId: 'admin',
                isAdmin: true,
                user: {
                    firstName: 'Admin',
                    lastName: 'User',
                    email: email,
                    status: 'active'
                }
            });
        }

        const users = readJSON(usersFile);
        const user = users.find(u => u.email === email);

        if (!user || user.passwordHash !== hashPassword(password)) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');

        res.json({
            message: 'Login successful',
            token,
            userId: user.userId,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET USER ACCOUNTS
app.get('/api/accounts/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const accounts = readJSON(accountsFile);
        const userAccounts = accounts.filter(a => a.userId === userId);
        res.json(userAccounts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching accounts' });
    }
});

// GET USER INFO
app.get('/api/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const users = readJSON(usersFile);
        const user = users.find(u => u.userId === userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            status: user.status,
            profilePhoto: user.profilePhoto,
            adminNote: user.adminNote,
            createdAt: user.createdAt,
            authVerification: user.authVerification || { enabled: false, authName: '', authCode: '' }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user' });
    }
});

// CREATE TRANSACTION - FIXED VERSION
app.post('/api/transactions', (req, res) => {
    try {
        const { fromAccountId, toAccountNumber, amount, type, description } = req.body;

        console.log('🔔 TRANSACTION STARTED:', { fromAccountId, toAccountNumber, amount, type });

        if (!fromAccountId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid transaction data' });
        }

        const accounts = readJSON(accountsFile);
        const users = readJSON(usersFile);
        
        // Find sender account
        const fromAccount = accounts.find(a => a.accountId === fromAccountId);
        console.log('👤 SENDER ACCOUNT:', fromAccount);

        if (!fromAccount) {
            return res.status(404).json({ message: 'Sender account not found' });
        }

        if (fromAccount.balance < amount) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        // Find recipient account
        let toAccount = null;
        if (toAccountNumber) {
            toAccount = accounts.find(a => a.accountNumber === toAccountNumber);
            console.log('👥 RECIPIENT ACCOUNT:', toAccount);
            
            if (!toAccount) {
                return res.status(404).json({ message: 'Recipient account not found' });
            }
            
            // Prevent sending to same account
            if (toAccount.accountId === fromAccountId) {
                return res.status(400).json({ message: 'Cannot send money to the same account' });
            }
        }

        // DEBIT FROM SENDER
        fromAccount.balance = parseFloat((fromAccount.balance - amount).toFixed(2));
        fromAccount.availableBalance = parseFloat((fromAccount.availableBalance - amount).toFixed(2));
        console.log('💸 DEBITED:', fromAccount.accountNumber, 'New balance:', fromAccount.balance);

        // CREDIT TO RECIPIENT
        if (toAccount) {
            toAccount.balance = parseFloat((toAccount.balance + amount).toFixed(2));
            toAccount.availableBalance = parseFloat((toAccount.availableBalance + amount).toFixed(2));
            console.log('💰 CREDITED:', toAccount.accountNumber, 'New balance:', toAccount.balance);
        }

        // Save updated accounts
        writeJSON(accountsFile, accounts);
        console.log('💾 ACCOUNTS SAVED');

        // Create transaction record
        const transaction = {
            transactionId: generateTransactionId(),
            fromAccountId,
            toAccountId: toAccount ? toAccount.accountId : null,
            fromUserId: fromAccount.userId,
            toUserId: toAccount ? toAccount.userId : null,
            amount: parseFloat(amount),
            type: type || 'transfer',
            description: description || '',
            recipientName: toAccount ? '' : 'External',
            recipientAccountNumber: toAccountNumber || '',
            status: 'completed',
            timestamp: new Date().toISOString()
        };

        const transactions = readJSON(transactionsFile);
        transactions.push(transaction);
        writeJSON(transactionsFile, transactions);
        console.log('📝 TRANSACTION SAVED:', transaction.transactionId);

        // Create notifications
        const fromUser = users.find(u => u.userId === fromAccount.userId);
        
        // Notification for sender
        createNotification(
            fromAccount.userId,
            'Money Sent',
            `You sent $${amount.toFixed(2)} to ${toAccount ? toAccount.accountName : 'external account'}`,
            'debit'
        );

        // Notification for recipient
        if (toAccount) {
            createNotification(
                toAccount.userId,
                'Money Received',
                `You received $${amount.toFixed(2)} from ${fromUser.firstName} ${fromUser.lastName}`,
                'credit'
            );
        }

        console.log('✅ TRANSACTION COMPLETED SUCCESSFULLY');
        res.status(201).json({
            message: 'Transaction successful',
            transaction
        });
    } catch (error) {
        console.error('❌ TRANSACTION ERROR:', error);
        res.status(500).json({ message: 'Transaction failed' });
    }
});

// GET TRANSACTIONS
app.get('/api/transactions/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const users = readJSON(usersFile);
        const accounts = readJSON(accountsFile);
        const transactions = readJSON(transactionsFile);

        const userAccounts = accounts.filter(a => a.userId === userId).map(a => a.accountId);
        
        const userTransactions = transactions.filter(t => 
            userAccounts.includes(t.fromAccountId) || userAccounts.includes(t.toAccountId)
        );

        // Enrich transactions with account and user details
        const enriched = userTransactions.map(t => {
            const fromAcc = accounts.find(a => a.accountId === t.fromAccountId);
            const toAcc = accounts.find(a => a.accountId === t.toAccountId);
            const fromUser = users.find(u => u.userId === t.fromUserId);
            const toUser = users.find(u => u.userId === t.toUserId);

            return {
                ...t,
                fromAccountName: fromAcc?.accountName,
                toAccountName: toAcc?.accountName,
                fromUserName: fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : t.recipientName,
                toUserName: toUser ? `${toUser.firstName} ${toUser.lastName}` : t.recipientName
            };
        });

        res.json(enriched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});

// GET NOTIFICATIONS
app.get('/api/notifications/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const notifications = readJSON(notificationsFile);
        const userNotifications = notifications.filter(n => n.userId === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(userNotifications);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

// MARK NOTIFICATION AS READ
app.put('/api/notifications/:notificationId/read', (req, res) => {
    try {
        const { notificationId } = req.params;
        const notifications = readJSON(notificationsFile);
        const notification = notifications.find(n => n.notificationId === notificationId);
        
        if (notification) {
            notification.isRead = true;
            writeJSON(notificationsFile, notifications);
        }
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification' });
    }
});

// GET UNREAD NOTIFICATION COUNT
app.get('/api/notifications/:userId/unread-count', (req, res) => {
    try {
        const { userId } = req.params;
        const notifications = readJSON(notificationsFile);
        const unreadCount = notifications.filter(n => n.userId === userId && !n.isRead).length;
        res.json({ unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count' });
    }
});

// VERIFY ACCOUNT NUMBER (for transfers)
app.get('/api/verify-account/:accountNumber', (req, res) => {
    try {
        const { accountNumber } = req.params;
        const accounts = readJSON(accountsFile);
        const users = readJSON(usersFile);

        const account = accounts.find(a => a.accountNumber === accountNumber);

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const user = users.find(u => u.userId === account.userId);

        res.json({
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            accountId: account.accountId,
            userId: account.userId
        });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying account' });
    }
});

// ADMIN ROUTES
app.get('/api/admin/users', (req, res) => {
    try {
        const users = readJSON(usersFile);
        res.json(users.map(u => ({
            userId: u.userId,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            status: u.status,
            createdAt: u.createdAt,
            adminNote: u.adminNote,
            authVerification: u.authVerification // Included authVerification in admin user list
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

app.put('/api/admin/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { status, adminNote, authVerification } = req.body;

        const users = readJSON(usersFile);
        const user = users.find(u => u.userId === userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (status) user.status = status;
        if (adminNote !== undefined) user.adminNote = adminNote;
        if (authVerification !== undefined) user.authVerification = authVerification;

        writeJSON(usersFile, users);

        res.json({ message: 'User updated', user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
});

app.post('/api/admin/fund-account', (req, res) => {
    try {
        const { accountNumber, amount, description } = req.body;

        if (!accountNumber || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid funding data' });
        }

        const accounts = readJSON(accountsFile);
        const account = accounts.find(a => a.accountNumber === accountNumber);

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        // Add funds
        account.balance += parseFloat(amount);
        account.availableBalance += parseFloat(amount);

        writeJSON(accountsFile, accounts);

        // Log transaction
        const transaction = {
            transactionId: generateTransactionId(),
            fromAccountId: null,
            toAccountId: account.accountId,
            fromUserId: 'admin',
            toUserId: account.userId,
            amount: parseFloat(amount),
            type: 'admin-funding',
            description: description || 'Admin funding',
            status: 'completed',
            timestamp: new Date().toISOString()
        };

        const transactions = readJSON(transactionsFile);
        transactions.push(transaction);
        writeJSON(transactionsFile, transactions);

        // Create notification for user
        createNotification(
            account.userId,
            'Account Funded',
            `Your account has been funded with $${amount.toFixed(2)} by admin`,
            'credit'
        );

        res.json({ message: 'Account funded successfully', account });
    } catch (error) {
        console.error('Funding error:', error);
        res.status(500).json({ message: 'Funding failed' });
    }
});

app.post('/api/admin/debit-account', (req, res) => {
    try {
        const { accountNumber, amount, note } = req.body;

        if (!accountNumber || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid debit data' });
        }

        const accounts = readJSON(accountsFile);
        const account = accounts.find(a => a.accountNumber === accountNumber);

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        // Check if account has sufficient balance
        if (account.balance < amount) {
            return res.status(400).json({ message: 'Insufficient funds in account' });
        }

        // Deduct funds
        account.balance = parseFloat((account.balance - amount).toFixed(2));
        account.availableBalance = parseFloat((account.availableBalance - amount).toFixed(2));

        writeJSON(accountsFile, accounts);

        // Log transaction
        const transaction = {
            transactionId: generateTransactionId(),
            fromAccountId: account.accountId,
            toAccountId: null,
            fromUserId: account.userId,
            toUserId: 'admin',
            amount: parseFloat(amount),
            type: 'admin-debit',
            description: note || 'Admin debit',
            status: 'completed',
            timestamp: new Date().toISOString()
        };

        const transactions = readJSON(transactionsFile);
        transactions.push(transaction);
        writeJSON(transactionsFile, transactions);

        // Create notification for user
        createNotification(
            account.userId,
            'Account Debited',
            `$${amount.toFixed(2)} has been debited from your account${note ? ': ' + note : ''}`,
            'debit'
        );

        res.json({ message: 'Account debited successfully', account });
    } catch (error) {
        console.error('Debit error:', error);
        res.status(500).json({ message: 'Debit failed' });
    }
});

app.get('/api/admin/accounts-summary', (req, res) => {
    try {
        const accounts = readJSON(accountsFile);
        const transactions = readJSON(transactionsFile);

        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const totalTransactions = transactions.length;

        res.json({
            totalBalance,
            totalTransactions,
            totalAccounts: accounts.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching summary' });
    }
});

// UPDATE USER INFO
app.put('/api/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, phone } = req.body;

        const users = readJSON(usersFile);
        const user = users.find(u => u.userId === userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;

        writeJSON(usersFile, users);

        res.json({ message: 'User updated', user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
});

// CHANGE PASSWORD
app.post('/api/change-password', (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const users = readJSON(usersFile);
        const user = users.find(u => u.userId === userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        if (user.passwordHash !== hashPassword(currentPassword)) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.passwordHash = hashPassword(newPassword);
        writeJSON(usersFile, users);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing password' });
    }
});

// DEBUG: Get all accounts
app.get('/api/debug/accounts', (req, res) => {
    try {
        const accounts = readJSON(accountsFile);
        const users = readJSON(usersFile);
        
        const enrichedAccounts = accounts.map(acc => {
            const user = users.find(u => u.userId === acc.userId);
            return {
                ...acc,
                userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
            };
        });
        
        res.json(enrichedAccounts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching accounts' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🏦 Yoooo server running on http://localhost:${PORT}`);
    console.log(`🔧 Admin login: xxxxxxxx `);
});
