import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../App';
import { BookOpen, Users, Calendar, TrendingUp, Clock, AlertCircle, User, Mail, Phone } from 'lucide-react';
import apiService from '../../services/api';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalUsers: 0,
    booksBorrowed: 0,
    overdueBooks: 0
  });
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [monthlyActivity, setMonthlyActivity] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [error, setError] = useState(null);

  // Define the main categories we want to track
  const mainCategories = ['fiction', 'non-fiction', 'manga'];

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Starting to load dashboard data...');

        // Fetch all data in parallel with error handling for each request
        const [booksResponse, usersResponse, borrowingsResponse, overdueResponse] = await Promise.allSettled([
          apiService.getBooks(),
          apiService.getUsers(),
          apiService.getBorrowings(),
          apiService.getOverdueBorrowings()
        ]);

        console.log('API Responses:', {
          books: booksResponse,
          users: usersResponse,
          borrowings: borrowingsResponse,
          overdue: overdueResponse
        });

        // Handle each response
        const books = booksResponse.status === 'fulfilled' ? booksResponse.value : [];
        const users = usersResponse.status === 'fulfilled' ? usersResponse.value : [];
        const borrowings = borrowingsResponse.status === 'fulfilled' ? borrowingsResponse.value : [];
        const overdueBorrowings = overdueResponse.status === 'fulfilled' ? overdueResponse.value : [];

        // Log any failed requests
        if (booksResponse.status === 'rejected') console.error('Books API failed:', booksResponse.reason);
        if (usersResponse.status === 'rejected') console.error('Users API failed:', usersResponse.reason);
        if (borrowingsResponse.status === 'rejected') console.error('Borrowings API failed:', borrowingsResponse.reason);
        if (overdueResponse.status === 'rejected') console.error('Overdue API failed:', overdueResponse.reason);

        // Calculate category statistics with proper grouping
        const categoryCounts = {};
        let otherCount = 0;

        books.forEach(book => {
          const category = book.category?.trim().toLowerCase() || 'uncategorized';

          // Check if this is one of our main categories
          if (mainCategories.includes(category)) {
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
          } else {
            // Group all other categories
            otherCount++;
          }
        });

        // Convert to array format for the chart with proper labels
        const categoryArray = mainCategories.map(category => ({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          count: categoryCounts[category] || 0,
          percentage: books.length > 0 ? ((categoryCounts[category] || 0) / books.length * 100).toFixed(1) : '0'
        }));

        // Add "Other" category if there are any books in other categories
        if (otherCount > 0) {
          categoryArray.push({
            category: 'Other',
            count: otherCount,
            percentage: books.length > 0 ? (otherCount / books.length * 100).toFixed(1) : '0'
          });
        }

        // Filter out categories with 0 books
        const filteredCategoryArray = categoryArray.filter(item => item.count > 0);
        setCategoryData(filteredCategoryArray);

        // Calculate active borrowings (status is BORROWED and returnDate is null)
        const activeBorrowings = Array.isArray(borrowings) ? 
          borrowings.filter(b => b.status === 'BORROWED' && !b.returnDate) : [];

        // Use the actual overdue borrowings from the API
        const overdueBooksCount = Array.isArray(overdueBorrowings) ? overdueBorrowings.length : 0;

        setStats({
          totalBooks: books.length || 0,
          totalUsers: users.length || 0,
          booksBorrowed: activeBorrowings.length,
          overdueBooks: overdueBooksCount
        });

        // Load currently borrowed books (active borrowings)
        let borrowedBooksList = [];
        if (Array.isArray(borrowings)) {
          // Filter for currently borrowed books (status BORROWED and no return date)
          const activeBorrowings = borrowings.filter(b => 
            b.status === 'BORROWED' && !b.returnDate
          );

          // Sort by due date (soonest first)
          const sortedBorrowings = [...activeBorrowings]
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 8); // Get 8 most urgent

          // Create borrowed books list with available data
          borrowedBooksList = sortedBorrowings.map((borrowing) => {
            // Find user and book details
            const userDetail = users.find(u => u.id === borrowing.userId);
            const bookDetail = books.find(b => b.id === borrowing.bookId);

            const dueDate = new Date(borrowing.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today;
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            return {
              id: borrowing.id,
              bookId: borrowing.bookId,
              bookTitle: borrowing.bookTitle || bookDetail?.title || 'Unknown Book',
              userId: borrowing.userId,
              username: borrowing.username || userDetail?.username || 'Unknown User',
              // User details from the users array
              userEmail: userDetail?.email || 'N/A',
              userPhone: userDetail?.phone || 'N/A',
              userStudentId: userDetail?.studentId || userDetail?.id || 'N/A',
              userFirstName: userDetail?.firstName || 'Unknown',
              userLastName: userDetail?.lastName || 'User',
              borrowDate: new Date(borrowing.borrowDate).toLocaleDateString(),
              dueDate: dueDate.toLocaleDateString(),
              isOverdue,
              daysUntilDue: isOverdue ? -Math.abs(daysUntilDue) : daysUntilDue,
              status: borrowing.status
            };
          });
        }

        setBorrowedBooks(borrowedBooksList);

        // Map overdue borrowings into a display-friendly list
        let overdueListMapped = [];
        if (Array.isArray(overdueBorrowings) && overdueBorrowings.length > 0) {
          const sortedOverdue = [...overdueBorrowings]
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 8);

          overdueListMapped = sortedOverdue.map(ob => {
            const userDetail = users.find(u => u.id === ob.userId);
            const bookDetail = books.find(b => b.id === ob.bookId);
            const dueDate = new Date(ob.dueDate);
            const today = new Date();
            
            return {
              id: ob.id,
              bookId: ob.bookId,
              bookTitle: ob.bookTitle || bookDetail?.title || 'Unknown Book',
              userId: ob.userId,
              username: ob.username || userDetail?.username || 'Unknown',
              userEmail: userDetail?.email || 'N/A',
              borrowDate: new Date(ob.borrowDate).toLocaleDateString(),
              dueDate: dueDate.toLocaleDateString(),
              daysOverdue: Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24))
            };
          });
        }

        setOverdueList(overdueListMapped);

        // Generate monthly activity from actual borrowings data
        const monthlyStats = calculateMonthlyActivity(borrowings);
        setMonthlyActivity(monthlyStats);

        // Build activity log from recent borrowings and returns
        const recentActivities = generateActivityLog(borrowings, users, books);
        setActivityLog(recentActivities);

        console.log('Dashboard data loaded successfully:', {
          booksCount: books.length,
          usersCount: users.length,
          borrowingsCount: borrowings.length,
          activeBorrowings: activeBorrowings.length,
          overdueBooks: overdueBooksCount,
          categories: filteredCategoryArray
        });

      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setError('Failed to load dashboard data. Please check your connection and try again.');
        // Fallback to empty data if API fails
        setStats({
          totalBooks: 0,
          totalUsers: 0,
          booksBorrowed: 0,
          overdueBooks: 0
        });
        setCategoryData([]);
        setBorrowedBooks([]);
        setMonthlyActivity([]);
      }

      setIsLoading(false);
    };

    loadDashboardData();
  }, []);

  // Calculate monthly activity from borrowings data
  const calculateMonthlyActivity = (borrowings) => {
    if (!Array.isArray(borrowings) || borrowings.length === 0) {
      return Array.from({ length: 12 }, () => 0);
    }

    const monthlyCounts = Array.from({ length: 12 }, () => 0);
    const currentYear = new Date().getFullYear();

    borrowings.forEach(borrowing => {
      if (borrowing.borrowDate) {
        const borrowDate = new Date(borrowing.borrowDate);
        if (borrowDate.getFullYear() === currentYear) {
          const month = borrowDate.getMonth();
          monthlyCounts[month]++;
        }
      }
    });

    return monthlyCounts;
  };

  // Generate activity log from borrowings
  const generateActivityLog = (borrowings, users, books) => {
    if (!Array.isArray(borrowings) || borrowings.length === 0) {
      return [];
    }

    // Get recent activities (last 8), sorted by most recent
    const recentActivities = [...borrowings]
      .sort((a, b) => {
        const dateA = new Date(a.borrowDate || a.returnDate || a.createdAt);
        const dateB = new Date(b.borrowDate || b.returnDate || b.createdAt);
        return dateB - dateA;
      })
      .slice(0, 8);

    return recentActivities.map(borrowing => {
      const user = users.find(u => u.id === borrowing.userId);
      const book = books.find(b => b.id === borrowing.bookId);
      
      // Determine activity type based on status and return date
      let activityType = 'Borrow';
      let activityDate = borrowing.borrowDate;
      
      if (borrowing.status === 'RETURNED' || borrowing.returnDate) {
        activityType = 'Return';
        activityDate = borrowing.returnDate || borrowing.updatedAt;
      }
      
      return {
        id: borrowing.id,
        type: activityType,
        title: book?.title || borrowing.bookTitle || 'Unknown Book',
        user: user?.username || borrowing.username || 'Unknown User',
        date: new Date(activityDate).toLocaleString()
      };
    });
  };

  // Function to generate vibrant colors for categories
  const getCategoryColor = (category) => {
    const colorMap = {
      'Fiction': '#FF6B6B',     // Vibrant Red
      'Non-fiction': '#4ECDC4',  // Vibrant Teal
      'Manga': '#45B7D1',       // Vibrant Blue
      'Other': '#FFA07A'        // Vibrant Light Salmon
    };

    return colorMap[category] || '#96CEB4'; // Fallback color
  };

  // Function to render the pie chart with real data
  const Chart = () => {
    if (categoryData.length === 0) {
      return (
        <div className={styles.noData}>
          <BookOpen size={32} />
          <p>No category data available</p>
        </div>
      );
    }

    // Calculate conic gradient for pie chart
    let currentAngle = 0;
    const gradientStops = categoryData.map(item => {
      const percentage = parseFloat(item.percentage);
      const startAngle = currentAngle;
      const endAngle = startAngle + (percentage * 3.6); // Convert percentage to degrees
      currentAngle = endAngle;

      return `${getCategoryColor(item.category)} ${startAngle}deg ${endAngle}deg`;
    }).join(', ');

    return (
      <div className={styles.chartContent}>
        <div
          className={styles.pieChart}
          style={{
            background: `conic-gradient(${gradientStops})`
          }}
        >
          <div className={styles.pieCenter}></div>
        </div>
        <div className={styles.chartLegend}>
          {categoryData.map((item, index) => (
            <div key={item.category} className={styles.legendItem}>
              <span
                className={styles.legendColor}
                style={{ backgroundColor: getCategoryColor(item.category) }}
              ></span>
              <span className={styles.legendText}>
                {item.category} ({item.percentage}%) - {item.count} books
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function to render monthly activity chart
  const MonthlyActivityChart = () => {
    const maxValue = Math.max(...monthlyActivity, 1); // Ensure at least 1 to avoid division by zero
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <div className={styles.barChart}>
        {monthlyActivity.map((count, index) => (
          <div
            key={index}
            className={styles.bar}
            style={{ 
              height: `${(count / maxValue) * 100}%` 
            }}
            title={`${monthNames[index]}: ${count} books`}
          >
            <span className={styles.barLabel}>{count}</span>
          </div>
        ))}
      </div>
    );
  };

  const getStatusColor = (isOverdue, daysUntilDue) => {
    if (isOverdue) return '#EF4444'; // Red for overdue
    if (daysUntilDue <= 3) return '#F59E0B'; // Amber for due soon
    return '#10B981'; // Green for normal
  };

  const getStatusText = (isOverdue, daysUntilDue) => {
    if (isOverdue) return `Overdue by ${Math.abs(daysUntilDue)} days`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  };

  const getFullName = (borrowedBook) => {
    // Try to use first + last name, fallback to username
    if (borrowedBook.userFirstName && borrowedBook.userLastName) {
      return `${borrowedBook.userFirstName} ${borrowedBook.userLastName}`;
    }
    return borrowedBook.username;
  };

  if (isLoading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.errorContainer}>
          <AlertCircle size={48} />
          <h3>Error Loading Dashboard</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.dashboardTitle}>Dashboard</h1>
          <p className={styles.dashboardSubtitle}>
            Welcome back, {user?.username || 'User'}! Here's what's happening in your library.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <BookOpen size={24} />
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.totalBooks.toLocaleString()}</h3>
            <p className={styles.statLabel}>Total Books</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Users size={24} />
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.totalUsers.toLocaleString()}</h3>
            <p className={styles.statLabel}>Total Users</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.booksBorrowed.toLocaleString()}</h3>
            <p className={styles.statLabel}>Books Borrowed</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <AlertCircle size={24} />
          </div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.overdueBooks.toLocaleString()}</h3>
            <p className={styles.statLabel}>Overdue Books</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className={styles.chartsSection}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Book Categories</h3>
          <div className={styles.chartContainer}>
            {Chart()}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Monthly Activity ({new Date().getFullYear()})</h3>
          <div className={styles.chartContainer}>
            <MonthlyActivityChart />
            <p className={styles.chartDescription}>Books borrowed per month</p>
          </div>
        </div>
      </div>

      {/* Currently Borrowed Books Section */}
      <div className={styles.activitySection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.activityTitle}>Currently Borrowed Books</h3>
          <span className={styles.badge}>{borrowedBooks.length} Active</span>
        </div>
        <div className={styles.borrowedBooksList}>
          {borrowedBooks.length === 0 ? (
            <div className={styles.noData}>
              <BookOpen size={32} />
              <p>No books are currently borrowed</p>
            </div>
          ) : (
            borrowedBooks.map((item) => (
              <div key={item.id} className={styles.borrowedBookCard}>
                <div className={styles.bookInfo}>
                  <div className={styles.bookHeader}>
                    <h4 className={styles.bookTitle}>{item.bookTitle}</h4>
                    <span
                      className={styles.statusBadge}
                      style={{
                        backgroundColor: `${getStatusColor(item.isOverdue, item.daysUntilDue)}20`,
                        color: getStatusColor(item.isOverdue, item.daysUntilDue)
                      }}
                    >
                      {getStatusText(item.isOverdue, item.daysUntilDue)}
                    </span>
                  </div>
                  <div className={styles.bookMeta}>
                    <span className={styles.metaItem}>
                      <Calendar size={14} />
                      Borrowed: {item.borrowDate}
                    </span>
                    <span className={styles.metaItem}>
                      <Clock size={14} />
                      Due: {item.dueDate}
                    </span>
                  </div>
                </div>

                <div className={styles.studentInfo}>
                  <div className={styles.studentHeader}>
                    <User size={16} />
                    <strong>Borrowed by:</strong>
                  </div>
                  <div className={styles.studentDetails}>
                    <p className={styles.studentName}>{getFullName(item)}</p>
                    <p className={styles.studentContact}>
                      <Mail size={12} />
                      {item.userEmail}
                    </p>
                    {item.userPhone !== 'N/A' && (
                      <p className={styles.studentContact}>
                        <Phone size={12} />
                        {item.userPhone}
                      </p>
                    )}
                    <p className={styles.studentId}>
                      Student ID: {item.userStudentId}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;