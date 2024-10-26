import { useEffect } from "react";
import useBooks from "../../hooks/useBooks";
import "./Books.css"; // Import the CSS file

const Books = () => {
  const { books, fetchBooks, deleteBook } = useBooks();

  useEffect(() => {
    fetchBooks();
  }, []);

  return (
    <div>
      <h1>Books</h1>
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
            {book.imageUrl && <img src={book.imageUrl} alt={book.title} />}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Books;
