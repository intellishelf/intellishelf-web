import { useCallback, useState } from "react";
import { apiClient } from "../utils/apiClient";

export interface Book {
  id: string;
  title: string;
  authors?: string;
  publicationDate?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
  pages?: number;
  coverImageUrl?: string;
  annotation?: string;
  tags?: string[];
  createdDate: string;
  userId: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export enum BookOrderBy {
  Title = "Title",
  Author = "Author", 
  Published = "Published",
  Added = "Added"
}

export interface BookQueryParameters {
  page?: number;
  pageSize?: number;
  orderBy?: BookOrderBy;
  ascending?: boolean;
}

const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBooks = useCallback(async (queryParams?: BookQueryParameters) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (queryParams?.page) params.append('page', queryParams.page.toString());
      if (queryParams?.pageSize) params.append('pageSize', queryParams.pageSize.toString());
      if (queryParams?.orderBy) params.append('orderBy', queryParams.orderBy);
      if (queryParams?.ascending !== undefined) params.append('ascending', queryParams.ascending.toString());

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const pagedResult = await apiClient.get<PagedResult<Book>>(`/books${queryString}`);

      setBooks(pagedResult.items);
      setTotalCount(pagedResult.totalCount);
      setTotalPages(pagedResult.totalPages);
      setCurrentPage(pagedResult.page);
    } catch (error) {
      console.error('Failed to fetch books:', error);
      // Could set an error state here if needed
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllBooks = useCallback(async () => {
    try {
      const books = await apiClient.get<Book[]>(`/books/all`);
      setBooks(books);
    } catch (error) {
      console.error('Failed to fetch all books:', error);
    }
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    try {
      await apiClient.delete<void>(`/books/${id}`);
      setBooks((prevBooks) => prevBooks.filter((book) => book.id !== id));
    } catch (error) {
      console.error('Failed to delete book:', error);
    }
  }, []);

  const addBook = useCallback(async (formData: FormData) => {
    try {
      const newBook = await apiClient.post<Book>(`/books`, formData);
      await fetchBooks(); // Refresh the list
      return { success: true, data: newBook };
    } catch (error) {
      return { success: false, error };
    }
  }, [fetchBooks]);

  const parseBookText = useCallback(async (text: string) => {
    try {
      return await apiClient.post<Book>(
        `/books/parse-text`,
        JSON.stringify({ text })
      );
    } catch (error) {
      console.error('Failed to parse book text:', error);
      return null;
    }
  }, []);

  return { 
    books, 
    totalCount,
    totalPages,
    currentPage,
    isLoading,
    fetchBooks, 
    fetchAllBooks,
    deleteBook, 
    addBook, 
    parseBookText 
  };
};

export default useBooks;
