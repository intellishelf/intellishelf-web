import React, { useState } from "react";
import { useForm } from "react-hook-form";

interface AddBookRequest {
  title: string;
  authors?: string;
  publicationDate?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
  pages?: number;
}

const AddBook = () => {
  const { register, handleSubmit, setValue } = useForm<AddBookRequest>();
  const [file, setFile] = useState<File | null>(null);
  const token = localStorage.getItem("token");

  const onSubmit = async (data: AddBookRequest) => {
    try {
      const response = await fetch("http://localhost:8080/api/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to add book");
      }

      console.log("Book added successfully");
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleParseImage = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://localhost:8080/api/books/parse-image",
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

      const parsedBook = await response.json();

      // Update form fields with parsed data
      Object.keys(parsedBook).forEach((key) => {
        setValue(key as keyof AddBookRequest, parsedBook[key]);
      });

      console.log("Image parsed successfully");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <div>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button type="button" onClick={handleParseImage}>
          Parse Image
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          {...register("title", { required: true })}
        />
        <br />
        <label htmlFor="authors">Authors:</label>
        <input type="text" id="authors" {...register("authors")} />
        <br />
        <label htmlFor="publicationDate">Publication Date:</label>
        <input
          type="date"
          id="publicationDate"
          {...register("publicationDate")}
        />
        <br />
        <label htmlFor="isbn">ISBN:</label>
        <input type="text" id="isbn" {...register("isbn")} />
        <br />
        <label htmlFor="description">Description:</label>
        <textarea id="description" {...register("description")} />
        <br />
        <label htmlFor="publisher">Publisher:</label>
        <input type="text" id="publisher" {...register("publisher")} />
        <br />
        <label htmlFor="pages">Pages:</label>
        <input type="number" id="pages" {...register("pages")} />
        <br />
        <input type="submit" value="Add Book" />
      </form>
    </div>
  );
};

export default AddBook;
