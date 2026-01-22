const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the root directory

// Supabase client (Admin)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to get client (admin or user-specific)
const getClient = (req) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // To act as the user, we initialize with the same URL but pass the user's JWT
        return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
    }
    return supabase;
};

// --- GET ME ---
app.get("/api/me", async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(' ')[1];
    const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error) return res.status(400).json({ error: error.message });

    res.json({ user });
});

// --- REGISTER ---
app.post("/api/register", async (req, res) => {
    const { email, password, username } = req.body;
    if (!email || !password || !username) return res.status(400).json({ error: "Missing fields" });

    // For registration, we use the standard signUp so it sends confirmation email
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: username }, emailRedirectTo: 'control-error-neurobreak.vercel.app' }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Check email for confirmation link!", user: data.user });
});

// --- LOGIN ---
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ session: data.session, user: data.user });
});

// --- FORGOT PASSWORD ---
app.post("/api/forgot-password", async (req, res) => {
    const { callsign } = req.body;
    if (!callsign) return res.status(400).json({ error: "Callsign required" });

    const { data: userData, error: findError } = await supabase
        .from("players")
        .select("email")
        .eq("username", callsign)
        .single();

    if (findError || !userData) return res.status(404).json({ error: "Callsign not found" });

    const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: 'https://control-error-neurobreak.vercel.app'
    });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Reset link sent to registered email." });
});

// --- UPDATE USER (Password or Metadata) ---
app.post("/api/update-user", async (req, res) => {
    const { userId, password, metadata } = req.body;
    const authHeader = req.headers['authorization'];

    console.log(`Update request for user: ${userId}`);

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Create client with user's token for user-level update
        const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        let updateData = {};
        if (password) updateData.password = password;
        if (metadata) updateData.data = metadata;

        console.log("Attempting user-level update via JWT...");
        const { data, error } = await userClient.auth.updateUser(updateData);
        if (!error) {
            console.log("User-level update successful");
            return res.json({ message: "User updated successfully", user: data.user });
        }
        console.error("User-level update failed:", error.message);
    }

    // Admin fallback: We should merge metadata manually here to be safe
    console.log("Attempting admin-level update fallback with merge...");

    // Fetch current user metadata first to ensure merge
    const { data: userRecord, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    let finalMetadata = metadata;
    if (!fetchError && userRecord && userRecord.user) {
        finalMetadata = { ...userRecord.user.user_metadata, ...metadata };
    }

    let updateData = { user_metadata: finalMetadata };
    if (password) updateData.password = password;

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updateData);
    if (error) {
        console.error("Admin update failed:", error.message);
        return res.status(400).json({ error: error.message });
    }

    console.log("Admin update successful");
    res.json({ message: "User updated successfully", user: data.user });
});

// --- DELETE ACCOUNT ---
app.post("/api/delete-account", async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) return res.status(400).json({ error: authError.message });

    await supabase.from("players").delete().eq("id", userId);
    res.json({ message: "Account deleted successfully" });
});

// --- AI PUZZLE GENERATION ---
app.post("/api/generate-puzzle", async (req, res) => {
    const { subjects, level, age } = req.body;
    const currentLevel = parseInt(level) || 1;
    const userAge = parseInt(age) || 18;

    // Determine difficulty based on level - More Granular
    let difficulty = "Beginner";
    if (currentLevel > 5) difficulty = "Intermediate";
    if (currentLevel > 10) difficulty = "Advanced";
    if (currentLevel > 20) difficulty = "Expert/Academic";

    // Neural Calibration based on Age
    let tone = "Standard";
    if (userAge < 13) {
        tone = "Fun, playful, adventurous, simple vocabulary. Use 1-2 emojis.";
    } else if (userAge < 18) {
        tone = "Cool, dynamic, modern, engaging (like a sci-fi game interface).";
    } else {
        tone = "Sophisticated, professional, sharp, concise, intellectual.";
    }

    // Choose ONE random field from the user's selected subjects
    let targetSubject = "General Science";
    if (subjects && typeof subjects === 'string') {
        // Handle cases where subjects might be comma-separated or just a single string
        const list = subjects.split(',').map(s => s.trim()).filter(s => s !== "");
        if (list.length > 0) {
            // True randomness: Sort randomly then pick first
            targetSubject = list.sort(() => 0.5 - Math.random())[0];
        }
    }

    const prompt = `CRITICAL: GENERATE A TOTALLY RANDOM AND UNIQUE MCQ QUESTION.
    TOPIC: ${targetSubject}
    DIFFICULTY: ${difficulty} (Level ${currentLevel})
    TARGET AUDIENCE AGE: ${userAge} years old
    TONE/STYLE: ${tone}
    TIMESTAMP SEED: ${Date.now()}
    
    1. The question must be unexpected and not a "classic" textbook example.
    2. Focus on a specific niche, inventor, theory, or conceptual fact within ${targetSubject}.
    3. QUESTION MUST BE SHORT (Max 15 words) and concise.
    4. Options must be short (Max 5 words).
    5. Options must be plausible, but one must be objectively correct.
    6. AVOID: repetitive 'What is', 'Who is' questions. Use scenarios or 'Which of these' formats.
    7. Format strictly as JSON with keys: "question", "options" (4 strings), "answer" (exact correct string).`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY} `,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt + `\nRANDOM_NONCE: ${Math.random().toString(36).substring(7)}` }],
                temperature: 1.0, // Maximum randomness
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const puzzle = JSON.parse(data.choices[0].message.content);

        // Prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(puzzle);
    } catch (err) {
        console.error("AI Puzzle Error:", err);
        // Fallback puzzle in case AI fails
        res.json({
            question: "What is 2 + 2?",
            options: ["3", "4", "5", "6"],
            answer: "4"
        });
    }
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));