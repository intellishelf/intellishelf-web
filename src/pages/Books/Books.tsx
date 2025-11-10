import { useEffect, useState, useCallback } from "react";
import useBooks, { BookOrderBy } from "../../hooks/useBooks";
import "./Books.css"; // Import the CSS file

const Books = () => {
  const { books, totalCount, totalPages, currentPage, isLoading, fetchBooks, deleteBook } = useBooks();
  const [orderBy, setOrderBy] = useState<BookOrderBy>(BookOrderBy.Added);
  const [ascending, setAscending] = useState(true);
  const [pageSize, setPageSize] = useState(3);

  const loadBooks = useCallback(() => {
    fetchBooks({ page: 1, pageSize, orderBy, ascending });
  }, [fetchBooks, pageSize, orderBy, ascending]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handlePageChange = (page: number) => {
    fetchBooks({ page, pageSize, orderBy, ascending });
  };

  const handleSortChange = (newOrderBy: BookOrderBy) => {
    if (newOrderBy === orderBy) {
      setAscending(!ascending);
    } else {
      setOrderBy(newOrderBy);
      setAscending(true);
    }
  };

  return (
    <div>
      <h1>Books ({totalCount} total)</h1>
      
      {/* Sorting Controls */}
      <div className="controls">
        <div className="sort-controls">
          <label>Sort by: </label>
          <button onClick={() => handleSortChange(BookOrderBy.Title)}>
            Title {orderBy === BookOrderBy.Title && (ascending ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSortChange(BookOrderBy.Author)}>
            Author {orderBy === BookOrderBy.Author && (ascending ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSortChange(BookOrderBy.Published)}>
            Published {orderBy === BookOrderBy.Published && (ascending ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSortChange(BookOrderBy.Added)}>
            Added {orderBy === BookOrderBy.Added && (ascending ? '↑' : '↓')}
          </button>
        </div>
        
        <div className="page-size-control">
          <label>Page size: </label>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {isLoading && <p>Loading...</p>}
      
      <ul>
        {books.map((book) => (
          <li key={book.id} className="book-item">
            <h3>
              {book.title}
              <button type="button" className="delete-button" onClick={() => deleteBook(book.id)}>
                &#128465;
              </button>
            </h3>
            <p>{book.authors}</p>
            {book.description && <p className="book-description">{book.description}</p>}
            {book.coverImageUrl && <img src={book.coverImageUrl} alt={book.title} />}
            <div className="book-meta">
              {book.publicationDate && <span>Published: {new Date(book.publicationDate).toLocaleDateString()}</span>}
              {book.pages && <span>Pages: {book.pages}</span>}
              {book.isbn && <span>ISBN: {book.isbn}</span>}
            </div>
            {book.tags && book.tags.length > 0 && (
              <div className="book-tags">
                {book.tags.map((tag, index) => (
                  <span key={index} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={currentPage === 1} 
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            disabled={currentPage === totalPages} 
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
          
          {/* Page numbers */}
          <div className="page-numbers">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button 
                  key={pageNum}
                  className={currentPage === pageNum ? 'active' : ''}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;
