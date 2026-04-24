# SplitKaro-AI 💸🤖

SplitKaro-AI is an intelligent, modern web application designed to make expense tracking and splitting among friends seamless and hassle-free. What sets it apart is its **AI-powered natural language parser**, which allows users to add expenses simply by typing like they would in a chat (e.g., *"John paid ₹500 for weekend pizza"*).

![SplitKaro-AI Banner](./assets/banner/banner.png)

## ✨ Features

- **🔐 Secure Authentication**: Supports both Google OAuth and standard Email/Password credentials using NextAuth.js.
- **👥 Group Management**: Create groups, invite friends, and manage memberships effortlessly.
- **🤖 AI-Powered Expense Entry**: Don't want to fill out long forms? Just type *"paid 1200 for movie tickets"* and the AI will automatically parse the amount, description, and payer.
- **📊 Smart Splitting algorithm**: Keep track of who owes who with precise `ExpenseSplit` and `Settlement` records.
- **⚡ Super Fast**: Built on the bleeding edge of React and Next.js (with Turbopack).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Directory)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Database ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Styling**: TailwindCSS (assuming default configuration)
- **Language**: TypeScript

---

## 🚀 Getting Started

Follow these steps to run the application locally on your machine.

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- A Google Cloud Console project for OAuth credentials

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/SplitKaro-AI.git
cd SplitKaro-AI/expense-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the `expense-ai` directory based on the provided `.env.example`:

```bash
cp .env.example .env
```

Update your `.env` file with your actual keys:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

NEXTAUTH_SECRET=your_super_secret_string_here
NEXTAUTH_URL=http://localhost:3000

# Your PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/split_karo_ai?schema=public
```

### 4. Database Setup

Once your PostgreSQL server is running and your `DATABASE_URL` is set, push the Prisma schema to your database:

```bash
npx prisma db push
```

*(Optional)* If you want to view the database through Prisma Studio:
```bash
npx prisma studio
```

### 5. Run the Application

Start the development server with Turbopack:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 💡 How the AI Parser Works

The AI parser evaluates natural language inputs to extract structured data. 
When hitting the `/api/groups/[groupId]/parse` endpoint:
- **Amount Extraction**: Intelligently identifies currency and amounts (e.g., `rs. 500`, `₹500`, `$50.25`).
- **Description Extraction**: Understands context markers like `for` or `on` (e.g., *"for lunch"* -> `Lunch`).
- **Payer Recognition**: Uses the group's members to identify if a specific person's name was mentioned as the payer.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check out the [issues page](https://github.com/yourusername/SplitKaro-AI/issues) if you want to contribute.

## 📝 License

This project is licensed under the MIT License.


## 📸 Screenshots

### Dashboard
![Dashboard](./assets/screenshots/SSPC2.png)

### Groups
![Groups](./assets/screenshots/SSPC3.png)

### Personal Expenses
![Personal](./assets/screenshots/SSPC4.png)
