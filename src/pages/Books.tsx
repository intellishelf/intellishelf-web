import { useEffect, useState } from "react";

interface Book {
  id: number;
  title: string;
  authors: string;
  isbn: string;
  pages: number;
  imageUrl: string;
}

const Books = () => {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("Token not found");
          return;
        }
        const response = await fetch("http://localhost:8080/api/books", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch books");
        }
        const data: Book[] = await response.json();
        setBooks(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchBooks();
  }, []);

  return (
    <div>
      <h1>Books</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id} className="book-item">
            <h2>{book.title}</h2>
            <p>Authors: {book.authors}</p>
            <p>ISBN: {book.isbn}</p>
            <p>Pages: {book.pages}</p>
            {book.imageUrl && <img src={book.imageUrl} alt={book.title} />}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Books;
