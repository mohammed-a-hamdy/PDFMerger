import React from 'react';

const FileDropzone = ({ getRootProps, getInputProps }) => {
  // Extract the openFileDialog function from getRootProps for the button
  const { openFileDialog, ...restRootProps } = getRootProps();
  
  return (
    <div 
      {...restRootProps} 
      className="box has-background-light has-text-centered p-6"
      style={{
        border: '2px dashed #dbdbdb',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.3s',
      }}
    >
      <input {...getInputProps()} />
      <div className="has-text-centered">
        <span className="icon is-large has-text-grey mb-4">
          <svg 
            width="48" 
            height="48" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </span>
        <h3 className="title is-4 mb-2 has-text-black">Drop files here or click to upload</h3>
        <p className="subtitle is-6 mb-4">
          Upload PDFs or images to merge into a single document
        </p>
        
        <p className="is-size-7 has-text-grey mt-4">
          Supports: PDF, JPEG, PNG
        </p>
      </div>
    </div>
  );
};

export default FileDropzone;
