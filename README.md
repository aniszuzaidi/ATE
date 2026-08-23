# ATE — What Should I Eat? 🍽️

> Can't decide what to eat? Tell us your cravings and we'll pick for you.

**ATE** is a fun, polished food-decision web app built with pure HTML, CSS, and vanilla JavaScript — no frameworks, no backend, no setup required.

---

## ✨ Features

- 🎰 **Food Decision Engine** — Slot-machine animation picks your meal
- 🎯 **Smart Matching** — Weighted scoring based on taste, hunger, spice, budget & distance
- 🍬 **Taste Filtering** — Sweet, Salty, Sour, Bitter, Spicy, Savory (multi-select)
- 🌶️ **Spiciness Filter** — Not Spicy → Very Spicy
- 😤 **Hunger Level** — Light, Normal, Very Hungry
- 💰 **Budget Filter** — Under RM10 to RM40+
- 📍 **Distance Filter** — Nearby, A little farther, Anywhere
- ➕ **Add Custom Foods** — Add your own foods with full taste profiles
- ✏️ **Edit & Delete** — Manage your food list
- ❤️ **Favorites** — Save and view your favourite picks
- 🔍 **Search & Filter** — Dynamic search by name/category
- 💾 **LocalStorage** — All data persists after browser refresh
- 📱 **Fully Responsive** — Works on desktop, tablet, and mobile

---

## 🛠️ Technologies

| Technology   | Usage                        |
|--------------|------------------------------|
| HTML5        | Structure & semantics        |
| CSS3         | Styling, animations, layout  |
| JavaScript   | Logic, interactivity         |
| LocalStorage | Persistent user data         |

---

## 📂 Project Structure

```
what-should-i-eat/
│
├── index.html          ← Main decide page
├── foods.html          ← My Foods management page
├── favorites.html      ← Favorites page
│
├── style.css           ← All styles (responsive + animated)
├── script.js           ← Core logic (shared across pages)
├── foods.js            ← Initial food dataset (24 foods)
├── foods-page.js       ← My Foods page logic (CRUD)
├── favorites-page.js   ← Favorites page logic
│
└── README.md
```

---

## 🚀 How to Run Locally

### Option 1 — Direct browser
1. Download or clone this project folder
2. Open `index.html` in any modern browser

> No server needed. All functionality works offline.

### Option 2 — VS Code Live Server (recommended for development)
1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code
2. Right-click `index.html` → **Open with Live Server**

---

## 🤖 How the Food Matching Algorithm Works

1. **Hard Filter** — Foods that don't match budget, spice level, or distance are removed entirely.
2. **Scoring** — Each remaining food receives a score based on:
   - Taste match: User-selected tastes × food taste intensity (0–5 scale)
   - Hunger match: Proximity between user's hunger level and food's meal size (up to 9 points)
3. **Ranking** — Foods are sorted by score descending.
4. **Weighted Random Selection** — A food is randomly picked from the top 30% (minimum 3) candidates, weighted by score. This ensures variety while respecting preferences.

---

## 💾 How LocalStorage Works

| Key            | Contents                         |
|----------------|----------------------------------|
| `ate_foods`    | All foods (initial + user-added) |
| `ate_favorites`| Array of favorited food IDs      |

- On first load, `INITIAL_FOODS` (24 foods) is seeded into `ate_foods`.
- User-created foods are added to this list and saved back.
- Favorites are stored as an array of food IDs for minimal duplication.
- All data serialized via `JSON.stringify` / `JSON.parse`.

---

## ☁️ Deploying to Render (Free Static Site)

1. Push the project to a GitHub repository
2. Go to [render.com](https://render.com) → **New → Static Site**
3. Connect your GitHub repo
4. Set:
   - **Build Command**: _(leave empty)_
   - **Publish Directory**: `.` (the root folder)
5. Click **Deploy**

Your site will be live at `https://your-app-name.onrender.com` 🎉

---

## 📖 Usage Guide

1. Open the website → **What Should I Eat?**
2. Select your taste preferences (or skip for "any")
3. Choose spice level, hunger, budget, and distance
4. Press **🎰 PICK FOR ME**
5. Watch the slot-machine animation
6. See your meal recommendation!
7. Hit **Try Again** for a different pick, or **Save to Favorites**

---

*Made with ❤️ and hunger.*
