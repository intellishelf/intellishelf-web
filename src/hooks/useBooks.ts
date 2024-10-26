import { useState } from "react";

export interface Book {
  id: number;
  title: string;
  authors: string;
  publicationDate?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
  pages: number;
  imageUrl: string;
}

const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);

  const fetchBooks = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("Token not found");
      return;
    }
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/books`, {
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
  };

  const deleteBook = async (id: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("Token not found");
      return;
    }
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/books/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error("Failed to delete book");
    }
    setBooks((prevBooks) => prevBooks.filter((book) => book.id !== id));
  };

  const addBook = async (bookData: Book) => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("Token not found");
      return;
    }
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bookData),
    });
    if (!response.ok) {
      throw new Error("Failed to add book");
    }
    // After adding a book, fetch the list again to refresh the state
    await fetchBooks();
  };

  const parseBookImage = async (file: File) => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("Token not found");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/books/parse-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );
    if (!response.ok) {
      throw new Error("Failed to parse image");
    }
    return response.json();
  };

  return { books, fetchBooks, deleteBook, addBook, parseBookImage };
};

export default useBooks;
