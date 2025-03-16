import { useState, useCallback, useEffect } from 'react';
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
  const [pdfPages, setPdfPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('merger'); // 'merger' or 'extractor'
  const [originalPdfName, setOriginalPdfName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Clear files/pages when switching tabs
  useEffect(() => {
    setFiles([]);
    setPdfPages([]);
    setOriginalPdfName('');
  }, [activeTab]);

  const onDropMerger = useCallback(async (acceptedFiles) => {
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

  const onDropExtractor = useCallback(async (acceptedFiles) => {
    // For extractor mode, only accept one PDF file at a time
    if (acceptedFiles.length === 0) return;
    
    // Take only the first file if multiple are dropped
    const file = acceptedFiles[0];
    
    // Only accept PDFs in extractor mode
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file for extraction.');
      return;
    }
    
    try {
      setLoading(true);
      setProgress(0);
      setOriginalPdfName(file.name);
      setPdfPages([]); // Clear previous pages
      
      // Read file
      const fileData = await readFileAsArrayBuffer(file);
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(fileData);
      const pageCount = pdfDoc.getPageCount();
      
      // Extract each page as a separate PDF
      const extractedPages = [];
      
      for (let i = 0; i < pageCount; i++) {
        // Update progress
        setProgress(((i + 1) / pageCount) * 100);
        
        // Create a new PDF with just this page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        
        // Save the single-page PDF
        const pagePdfBytes = await newPdf.save();
        
        // Create a thumbnail
        const thumbnail = await createThumbnailFromPdf(newPdf);
        
        extractedPages.push({
          id: `page-${i}`,
          pageNumber: i + 1,
          pdfBytes: pagePdfBytes,
          thumbnail,
          size: pagePdfBytes.length,
        });
      }
      
      setPdfPages(extractedPages);
    } catch (error) {
      console.error('Error extracting PDF pages:', error);
      alert(`Error extracting PDF pages: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);
  
  const { getRootProps: getMergerRootProps, getInputProps: getMergerInputProps } = useDropzone({
    onDrop: onDropMerger,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    disabled: activeTab !== 'merger'
  });

  const { getRootProps: getExtractorRootProps, getInputProps: getExtractorInputProps } = useDropzone({
    onDrop: onDropExtractor,
    accept: {
      'application/pdf': ['.pdf']
    },
    disabled: activeTab !== 'extractor',
    multiple: false
  });

  const handleDragEndMerger = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndExtractor = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setPdfPages((pages) => {
        const oldIndex = pages.findIndex((page) => page.id === active.id);
        const newIndex = pages.findIndex((page) => page.id === over.id);
        
        return arrayMove(pages, oldIndex, newIndex);
      });
    }
  };
  
  const removeFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  const removePage = (id) => {
    setPdfPages((prevPages) => prevPages.filter((page) => page.id !== id));
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

  const saveExtractedPDF = async () => {
    if (pdfPages.length === 0) {
      alert('No pages to save.');
      return;
    }
    
    try {
      setLoading(true);
      setProgress(0);
      
      // Create a new PDF document
      const extractedPdf = await PDFDocument.create();
      
      // Loop through all pages and add them to the new PDF
      for (let i = 0; i < pdfPages.length; i++) {
        const page = pdfPages[i];
        // Update progress
        setProgress(((i + 1) / pdfPages.length) * 100);
        
        // Load the PDF page
        const pagePdf = await PDFDocument.load(page.pdfBytes);
        
        // Copy the page to the new PDF
        const [copiedPage] = await extractedPdf.copyPages(pagePdf, [0]);
        extractedPdf.addPage(copiedPage);
      }
      
      // Save the extracted PDF
      const extractedPdfBytes = await extractedPdf.save();
      
      // Create a blob from the PDF bytes
      const blob = new Blob([extractedPdfBytes], { type: 'application/pdf' });
      
      // Generate filename based on original name
      const filename = originalPdfName 
        ? `extracted-${originalPdfName}` 
        : 'extracted-document.pdf';
      
      // Save the blob as a file
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error saving extracted PDF:', error);
      alert(`Error saving extracted PDF: ${error.message}`);
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
              <h1 className="title is-2 mb-2 has-text-primary">PDF Tools</h1>
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
            </div>

            {/* Tab Navigation */}
            <div className="tabs is-centered is-boxed mb-5">
              <ul>
                <li className={activeTab === 'merger' ? 'has-text-black is-active' : 'has-text-black'}>
                  <a onClick={() => setActiveTab('merger')}>
                    <span className="icon is-small">
                      <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span>PDF Merger</span>
                  </a>
                </li>
                <li className={activeTab === 'extractor' ? 'is-active' : ''}>
                  <a onClick={() => setActiveTab('extractor')}>
                    <span className="icon is-small">
                      <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                        <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                      </svg>
                    </span>
                    <span>PDF Extractor</span>
                  </a>
                </li>
              </ul>
            </div>
            
            {/* Conditional Tab Content */}
            {activeTab === 'merger' && (
              <>
                <p className={`subtitle is-5 has-text-${['warning', 'primary', 'danger', 'info', 'success'][Math.floor((Date.now() / 1000) % 5)]} has-text-centered mb-5`}>
                  Merge multiple PDFs and images into a single document
                </p>
                
                {/* File Upload Area */}
                <div className="mb-6">
                  <FileDropzone   
                    getRootProps={getMergerRootProps} 
                    getInputProps={getMergerInputProps} 
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
                      onDragEnd={handleDragEndMerger}
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
              </>
            )}

            {activeTab === 'extractor' && (
              <>
                <p className={`subtitle is-5 has-text-${['warning', 'primary', 'danger', 'info', 'success'][Math.floor((Date.now() / 1000) % 5)]} has-text-centered mb-5`}>
                  Extract, reorder, and remove pages from a PDF document
                </p>
                
                {/* File Upload Area for Extractor */}
                {pdfPages.length === 0 && (
                  <div className="mb-6">
                    <FileDropzone   
                      getRootProps={getExtractorRootProps} 
                      getInputProps={getExtractorInputProps} 
                    />
                  </div>
                )}
                
                {/* Page List */}
                {pdfPages.length > 0 && (
                  <div className="mb-6">
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
                      <div>
                        <h2 className="title is-4 mb-0 has-text-primary">Pages in Document</h2>
                        <p className="has-text-grey is-size-7">From: {originalPdfName}</p>
                      </div>
                      <p className="has-text-grey">Drag to reorder</p>
                    </div>
                    
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndExtractor}
                    >
                      <SortableContext
                        items={pdfPages.map(page => page.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="mb-4">
                          {pdfPages.map((page) => (
                            <SortableItem
                              key={page.id}
                              id={page.id}
                              file={{
                                ...page,
                                name: `Page ${page.pageNumber}`,
                                type: 'application/pdf'
                              }}
                              onRemove={() => removePage(page.id)}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                    
                    {/* Actions */}
                    <div className="is-flex is-justify-content-space-between is-align-items-center">
                      <div>
                        <button 
                          className="button is-light mr-2"
                          onClick={() => {
                            setPdfPages([]);
                            setOriginalPdfName('');
                          }}
                          disabled={loading}
                        >
                          Clear & Upload New
                        </button>
                      </div>
                      
                      <button 
                        className={`button is-link ${loading ? 'is-loading' : ''}`}
                        onClick={saveExtractedPDF}
                        disabled={pdfPages.length < 1 || loading}
                      >
                        {loading ? 'Saving...' : 'Save Modified PDF'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Empty State */}
                {pdfPages.length === 0 && !loading && (
                  <div className="box has-text-centered p-6 mt-6">
                    <span className="icon is-large has-text-grey mb-4">
                      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <h3 className="title is-4 mb-2">No PDF Uploaded</h3>
                    <p className="subtitle is-6 mb-4">
                      Upload a PDF to extract and manipulate its pages
                    </p>
                  </div>
                )}
              </>
            )}
            
            {/* Progress Bar (when processing) */}
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
          </div>
        </div>
      </section>
      
      <footer className="footer">
        <div className="content has-text-centered">
          <p>
            <strong className="has-text-primary">📄 PDF Tools 🔀</strong> - Tools for working with PDF files and images 🖼️ with ease 🚀
            <br />
            <strong className="has-text-danger">Made with ❤️ by Mohammed A.</strong> 
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
