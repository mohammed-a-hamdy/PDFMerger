import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { useDropzone } from 'react-dropzone';
import { Analytics } from "@vercel/analytics/react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './components/SortableItem';
import FileDropzone from './components/FileDropzone';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDrop = useCallback(async (acceptedFiles) => {
    try {
      setLoading(true);
      setProgress(0);
      
      const newFiles = await Promise.all(
        acceptedFiles.map(async (file, index) => {
          // Set progress for each file
          const progressStep = 100 / acceptedFiles.length;
          setProgress((prevProgress) => prevProgress + progressStep * 0.5);
          
          // Read file
          const fileData = await readFileAsArrayBuffer(file);
          
          // Check if it's a PDF already
          const isPdf = file.type === 'application/pdf';
          
          // Create preview and add to files
          let pdfBytes, thumbnail;
          
          if (isPdf) {
            // Load existing PDF
            const pdfDoc = await PDFDocument.load(fileData);
            pdfBytes = await pdfDoc.save();
            thumbnail = await createThumbnailFromPdf(pdfDoc);
          } else if (file.type.startsWith('image/')) {
            // Convert image to PDF
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([600, 800]);
            
            // Get image format and embed it
            let image;
            if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
              image = await pdfDoc.embedJpg(fileData);
            } else if (file.type === 'image/png') {
              image = await pdfDoc.embedPng(fileData);
            } else {
              throw new Error(`Unsupported image format: ${file.type}`);
            }
            
            // Draw image on page
            const { width, height } = image.size();
            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();
            
            // Calculate scaling to fit the page while maintaining aspect ratio
            const scale = Math.min(
              pageWidth / width,
              pageHeight / height
            );
            
            // Calculate centered position
            const x = (pageWidth - width * scale) / 2;
            const y = (pageHeight - height * scale) / 2;
            
            // Draw the image
            page.drawImage(image, {
              x,
              y,
              width: width * scale,
              height: height * scale,
            });
            
            pdfBytes = await pdfDoc.save();
            thumbnail = await createThumbnailFromPdf(pdfDoc);
          } else {
            throw new Error(`Unsupported file type: ${file.type}`);
          }
          
          // Update progress for completed file
          setProgress((prevProgress) => prevProgress + progressStep * 0.5);
          
          return {
            id: `${Date.now()}-${index}`,
            name: file.name,
            size: file.size,
            type: file.type,
            pdfBytes,
            thumbnail
          };
        })
      );
      
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    } catch (error) {
      console.error('Error processing files:', error);
      alert(`Error processing files: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);
  
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  const removeFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };
  
  const mergePDFs = async () => {
    if (files.length === 0) {
      alert('Please add at least one file to merge.');
      return;
    }
    
    try {
      setLoading(true);
      setProgress(0);
      
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Loop through all files and add their pages to the merged PDF
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Update progress
        setProgress(((i + 1) / files.length) * 100);
        
        // Load the PDF
        const pdf = await PDFDocument.load(file.pdfBytes);
        
        // Copy all pages from the current PDF to the merged PDF
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }
      
      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      
      // Create a blob from the PDF bytes
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      
      // Save the blob as a file
      saveAs(blob, 'merged-document.pdf');
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert(`Error merging PDFs: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };
  
  // Helper function to read a file as ArrayBuffer
  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };
  
  // Function to create thumbnail from PDF
  const createThumbnailFromPdf = async (pdfDoc) => {
    try {
      // Get first page
      const pages = pdfDoc.getPages();
      if (pages.length === 0) return null;
      
      const firstPage = pages[0];
      
      // Create a new PDF with just the first page for the thumbnail
      const thumbnailPdf = await PDFDocument.create();
      const [copiedPage] = await thumbnailPdf.copyPages(pdfDoc, [0]);
      thumbnailPdf.addPage(copiedPage);
      
      // Convert to data URL for display
      const pdfBytes = await thumbnailPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return null;
    }
  };

  return (
    <div className="container has-background-white">
      <Analytics />
      <section className="section">
        <div className="columns is-centered">
          <div className="column is-10-tablet is-8-desktop">
            <div className="has-text-centered mb-6">
              <h1 className="title is-2 mb-2 has-text-primary">PDF Merger</h1>
              <div className="quote-container">
                <div className="quote-image">
                  <img src="/image.jpg" alt="Dr. Manar Khatab" />
                </div>
                <div className="quote-text">
                  <blockquote>
                    "Oh, mon Dieu, c'est incroyable! Je n'ai jamais vu un outil aussi simple et efficace pour fusionner des fichiers PDF. C'est un outil indispensable pour tous les professionnels de la santé."
                    <footer>— Dr. Manar Khattab</footer>
                  </blockquote>
                </div>
              </div>
              <p className={`subtitle is-5 has-text-${['warning', 'primary', 'danger', 'info', 'success'][Math.floor((Date.now() / 1000) % 5)]}`}>
                Merge multiple PDFs and images into a single document
              </p>
            </div>
            
            {/* File Upload Area */}
            <div className="mb-6">
              <FileDropzone   
                getRootProps={getRootProps} 
                getInputProps={getInputProps} 
              />
            </div>
            
            {/* File List */}
            {files.length > 0 && (
              <div className="mb-6">
                <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
                  <h2 className="title is-4 mb-0 has-text-primary">Files to Merge</h2>
                  <p className="has-text-grey">Drag to reorder</p>
                </div>
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={files.map(file => file.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="mb-4">
                      {files.map((file) => (
                        <SortableItem
                          key={file.id}
                          id={file.id}
                          file={file}
                          onRemove={() => removeFile(file.id)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
                
                {/* Actions */}
                <div className="is-flex is-justify-content-space-between is-align-items-center">
                  <button 
                    className="button is-light"
                    onClick={() => setFiles([])}
                    disabled={loading}
                  >
                    Clear All
                  </button>
                  
                  <button 
                    className={`button is-link ${loading ? 'is-loading' : ''}`}
                    onClick={mergePDFs}
                    disabled={files.length < 1 || loading}
                  >
                    {loading ? 'Merging...' : 'Merge PDFs'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Progress Bar (when merging) */}
            {loading && (
              <div className="mt-4">
                <progress 
                  className="progress is-primary" 
                  value={progress} 
                  max="100"
                >
                  {progress}%
                </progress>
                <p className="has-text-centered has-text-grey">{progress}% Complete</p>
              </div>
            )}
            
            {/* Empty State */}
            {files.length === 0 && !loading && (
              <div className="box has-text-centered p-6 mt-6">
                <span className="icon is-large has-text-grey mb-4">
                  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <h3 className="title is-4 mb-2">No Files Added</h3>
                <p className="subtitle is-6 mb-4">
                  Upload PDFs or images to combine them into a single document
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      
      <footer className="footer">
        <div className="content has-text-centered">
          <p>
            <strong className="has-text-primary">📄 PDF Merger 🔀</strong> - A tool for merging PDF files and images 🖼️ with ease 🚀
            <br />
            <strong className="has-text-danger">Made with ❤️ by Mohammed A.</strong> 
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
