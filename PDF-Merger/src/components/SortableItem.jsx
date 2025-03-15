import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

export function SortableItem({ id, file, onRemove }) {
  const [thumbnailError, setThumbnailError] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Get file icon based on type
  const getFileIcon = () => {
    if (file.type === 'application/pdf') {
      return (
        <svg className="has-text-danger" width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    } else if (file.type.startsWith('image/')) {
      return (
        <svg className="has-text-info" width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="has-text-grey" width="32" height="32" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
  };
  
  const FilePreview = () => {
    if (file.thumbnail && !thumbnailError) {
      return (
        <div className="mr-3" style={{ width: '48px', height: '64px', backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <object
            data={file.thumbnail}
            type="application/pdf"
            style={{ width: '100%', height: '100%' }}
            onError={() => setThumbnailError(true)}
          >
            {getFileIcon()}
          </object>
        </div>
      );
    } else {
      return (
        <div className="mr-3" style={{ width: '48px', height: '64px', backgroundColor: '#f5f5f5', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {getFileIcon()}
        </div>
      );
    }
  };
  
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="box mb-3 p-3 is-relative has-background-light"
    >
      <div className="is-flex is-align-items-center">
        <div
          className="is-flex is-justify-content-center is-align-items-center" 
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '40px', cursor: 'grab' }}
          {...attributes}
          {...listeners}
        >
          <span className="icon has-text-grey">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </span>
        </div>
        
        <div className="is-flex is-align-items-center ml-5" style={{ flex: 1 }}>
          
          
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="has-text-weight-medium mb-1 has-text-primary" style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</h3>
            <p className="has-text-grey is-size-7">{formatFileSize(file.size)}</p>
          </div>
        </div>
        
        <button
          onClick={() => onRemove(id)}
          className="button is-small is-white is-rounded"
          aria-label="Remove file"
        >
          <span className="icon has-text-grey is-small">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        </button>
      </div>
    </li>
  );
}
