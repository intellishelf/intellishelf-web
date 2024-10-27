import { useState } from "react";
import { apiClient } from "../utils/apiClient";

export interface Book {
  id: number;
  title: string;
  authors?: string;
  publicationDate?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
  pages?: number;
  imageUrl?: string;
}

const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);

  const fetchBooks = async () => {
    const response = await apiClient.get<Book[]>(`/api/books`);

    if (response.data) setBooks(response.data);
  };

  const deleteBook = async (id: number) => {
    const response = await apiClient.delete(`/api/books/${id}`);
    if (response.isSuccess)
      setBooks((prevBooks) => prevBooks.filter((book) => book.id !== id));
  };

  const addBook = async (bookData: Book) => {
    const response = await apiClient.post(
      `/api/books`,
      JSON.stringify(bookData)
    );
    if (response.isSuccess) await fetchBooks();
  };

  const parseBookImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<Book>(
      `/api/books/parse-image`,
      formData
    );
    return response.data;
  };

  return { books, fetchBooks, deleteBook, addBook, parseBookImage };
};

export default useBooks;
