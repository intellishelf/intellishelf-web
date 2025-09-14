import React, { useState } from "react";
import { useForm } from "react-hook-form";
import "./AddBook.css"; // Import the CSS file
import useBooks from "../../hooks/useBooks"; // Import the useBooks hook
import { ApiError } from "../../utils/apiClient";

interface BookFormData {
  title: string;
  authors?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
  pages?: number;
  publicationDate?: string;
  annotation?: string;
}

const AddBook = () => {
  const { register, handleSubmit, setValue, reset } = useForm<BookFormData>();
  const { addBook, parseBookText } = useBooks();
  const [bookImage, setBookImage] = useState<File | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [bookIsParsing, setBookIsParsing] = useState(false);
  const [error, setError] = useState<string>("");

  const onSubmit = async (data: BookFormData) => {
    try {
      setError("");
      const formData = new FormData();
      
      // Add form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value.toString());
        }
      });
      
      // Add image file if selected
      if (bookImage) {
        formData.append('imageFile', bookImage);
      }
      
      const response = await addBook(formData);
      if (response.success) {
        setModalVisible(true);
        reset();
        setBookImage(null);
      } else {
        if (response.error instanceof ApiError) {
          setError(response.error.problemDetails.title);
        } else if (response.error instanceof Error) {
          setError(response.error.message);
        } else {
          setError("Failed to add book");
        }
      }
    } catch (error) {
      console.error(error);
      setError("An unexpected error occurred");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setBookImage(event.target.files[0]);
    }
  };

  const handleParseText = async (text: string) => {
    if (!text.trim()) return;

    setBookIsParsing(true);

    try {
      const parsedBook = await parseBookText(text);
      if (parsedBook) {
        // Map the parsed book data to form fields
        if (parsedBook.title) setValue("title", parsedBook.title);
        if (parsedBook.authors) setValue("authors", parsedBook.authors);
        if (parsedBook.isbn) setValue("isbn", parsedBook.isbn);
        if (parsedBook.description) setValue("description", parsedBook.description);
        if (parsedBook.publisher) setValue("publisher", parsedBook.publisher);
        if (parsedBook.pages) setValue("pages", parsedBook.pages);
        if (parsedBook.publicationDate) setValue("publicationDate", parsedBook.publicationDate);
        if (parsedBook.annotation) setValue("annotation", parsedBook.annotation);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to parse text");
    }

    setBookIsParsing(false);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  return (
    <div className="add-book-container">
      <form onSubmit={handleSubmit(onSubmit)} className="add-book-form">
        <h2>Add New Book</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {/* Text parsing section */}
        <div className="parse-section">
          <label htmlFor="parseText">Parse book information from text:</label>
          <textarea
            id="parseText"
            className="add-book-input add-book-textarea"
            placeholder="Paste book information here to auto-fill form..."
          />
          <button
            type="button"
            onClick={(e) => {
              const target = e.target as HTMLButtonElement;
              const textarea = target.previousElementSibling as HTMLTextAreaElement;
              handleParseText(textarea.value);
            }}
            className="parse-button"
            disabled={bookIsParsing}
          >
            {bookIsParsing ? "Parsing..." : "Parse Text"}
          </button>
        </div>

        {/* File upload section */}
        <div className="file-section">
          <label htmlFor="imageFile">Cover Image (optional):</label>
          <input
            type="file"
            id="imageFile"
            accept="image/*"
            onChange={handleFileChange}
            className="add-book-file"
          />
          {bookImage && <p>Selected: {bookImage.name}</p>}
        </div>

        {/* Form fields */}
        <label htmlFor="title">Title *:</label>
        <input
          type="text"
          id="title"
          className="add-book-input"
          {...register("title", { required: true })}
        />
        
        <label htmlFor="authors">Authors:</label>
        <input
          type="text"
          id="authors"
          className="add-book-input"
          {...register("authors")}
        />
        
        <label htmlFor="isbn">ISBN:</label>
        <input
          type="text"
          id="isbn"
          className="add-book-input"
          {...register("isbn")}
        />
        
        <label htmlFor="description">Description:</label>
        <textarea
          id="description"
          className="add-book-input add-book-textarea"
          {...register("description")}
        />
        
        <label htmlFor="annotation">Annotation/Notes:</label>
        <textarea
          id="annotation"
          className="add-book-input add-book-textarea"
          {...register("annotation")}
        />
        
        <label htmlFor="publisher">Publisher:</label>
        <input
          type="text"
          id="publisher"
          className="add-book-input"
          {...register("publisher")}
        />
        
        <label htmlFor="pages">Pages:</label>
        <input
          type="number"
          id="pages"
          className="add-book-input"
          {...register("pages")}
        />
        
        <label htmlFor="publicationDate">Publication Date:</label>
        <input
          type="date"
          id="publicationDate"
          className="add-book-input"
          {...register("publicationDate")}
        />
        
        <input type="submit" value="Add Book" className="add-book-button" />
      </form>

      {bookIsParsing && (
        <div className="loader-modal">
          <div className="loader-content">Recognizing...</div>
        </div>
      )}

      {modalVisible && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>
              &times;
            </span>
            <p>Book added successfully!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddBook;
