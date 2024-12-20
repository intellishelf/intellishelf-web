import React, { useState } from "react";
import { useForm } from "react-hook-form";
import "./AddBook.css"; // Import the CSS file
import useBooks, { Book } from "../../hooks/useBooks"; // Import the useBooks hook and Book interface

const AddBook = () => {
  const { register, handleSubmit, setValue } = useForm<Book>();
  const { addBook, parseBookImage } = useBooks();
  const [bookImage, setBookImage] = useState<File | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [bookIsParsing, setBookIsParsing] = useState(false); // New state for loading

  const onSubmit = async (data: Book) => {
    try {
      await addBook(data);
      setModalVisible(true); // Show the modal on success
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setBookImage(event.target.files[0]);
    }
  };

  const handleParseImage = async () => {
    if (!bookImage) return;

    setBookIsParsing(true);

    try {
      const parsedBook = await parseBookImage(bookImage);
      if (parsedBook) {
        Object.keys(parsedBook).forEach((key) => {
          setValue(key as keyof Book, parsedBook[key as keyof Book]);
        });
      }
    } catch (error) {
      console.error(error);
    }

    setBookIsParsing(false);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  return (
    <div className="add-book-container">
      <form onSubmit={handleSubmit(onSubmit)} className="add-book-form">
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="add-book-file" // Apply the new class for styling
          />
          <button
            type="button"
            onClick={handleParseImage}
            className="parse-button"
          >
            Parse Image
          </button>
        </div>
        <label htmlFor="title">Title:</label>
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
          type="text"
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
