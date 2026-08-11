const SECTIONS = [
  {
    title: "Dashboard",
    items: [
      "KPI cards show Today, This Month, This Year, Daily Average, Expense Count, Biggest Expense, Average Expense, and Top Category.",
      "Financial Health Score (0-100) reflects budget compliance and spending trends compared to last month.",
      "Smart Insights automatically highlight unusual spending patterns, exceeded budgets, and your highest spending weekday.",
      "Daily Spending Trend chart shows the last 30 days.",
      "Budget Overview only appears if you enable budgets in Settings.",
    ],
  },
  {
    title: "Add Expense",
    items: [
      "Fill Name, Date, Amount, and Category (all required), plus optional Payment Method and Notes.",
      "Click 'Add Expense' or press Ctrl+S to save.",
      "Press Ctrl+Z right after saving to undo the last entry.",
      "Press Esc to clear the form.",
      "The right panel shows your last 7 expenses for quick reference.",
    ],
  },
  {
    title: "Search",
    items: [
      "Type any keyword to search across name, notes, category, and payment method.",
      "Combine with Category, Payment Method, and Date Range filters for precise results.",
      "Double-click any result to edit or delete it.",
      "Use 'Clear Filters' to reset your search instantly.",
    ],
  },
  {
    title: "All Expenses",
    items: [
      "Click any column header (Name, Date, Amount) to sort.",
      "Use Quick Filters (Today, This Week, This Month, This Year) or the Category/Payment dropdowns.",
      "Select rows with the checkboxes and click 'Export' to download a CSV of just those rows (or all filtered rows if none selected).",
      "Double-click a row to open the edit modal, where you can also delete the expense (moves it to the Recycle Bin).",
    ],
  },
  {
    title: "Calendar",
    items: [
      "Each day is color-coded by spending level: gray = none, blue = low, orange = medium, red = high.",
      "Click any day to see its expenses, total, and top category in the side panel.",
      "Use the arrows to navigate between months.",
      "Monthly stats above the calendar summarize total spending, days with spending, no-spend days, and your highest single day.",
    ],
  },
  {
    title: "Analytics",
    items: [
      "Switch between This Month, This Year, and All Time using the buttons at the top.",
      "Spending by Category and Category Breakdown visualize where your money goes.",
      "Payment Method Analysis shows how you pay (cash, card, wallet, etc.).",
      "Monthly Trend shows your last 12 months of spending.",
      "This Month vs Last Month highlights which categories grew or shrank the most.",
    ],
  },
  {
    title: "Settings",
    items: [
      "Categories / Sub Categories / Payment Methods / Tags: full CRUD for your lists.",
      "Budgets: enable the budget system, then set a General Monthly Budget and/or per-category budgets.",
      "Savings Goals: track progress toward a target amount and date.",
      "Recurring Expenses: set up bills like rent or subscriptions. Nothing is added automatically — you confirm each one manually when it's due.",
      "Security: set or change your password, or disable it. Configure Auto-Lock (5/10/15 minutes of inactivity).",
      "Data Tools: export a full JSON backup, import one to restore, or permanently delete all data.",
    ],
  },
];

export default function Guide() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Guide</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        A quick reference for every page and feature in Expense Manager.
      </p>
      {SECTIONS.map((s) => (
        <div key={s.title} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{s.title}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
            {s.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
