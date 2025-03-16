import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

export function SortableItem({ id, file, onRemove }) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
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
      style={{
        ...style,
        transition: `${style.transition}, height 0.3s ease-in-out`,
      }}
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
          <FilePreview />
          
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="has-text-weight-medium mb-1 has-text-primary" style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</h3>
            <p className="has-text-grey is-size-7">{formatFileSize(file.size)}</p>
          </div>
        </div>

        <div className="is-flex">
          {file.type === 'application/pdf' && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`button is-small ${expanded ? 'is-primary' : 'is-primary is-light'} is-rounded mr-2`}
              aria-label={expanded ? "Hide preview" : "Show preview"}
              title={expanded ? "Hide preview" : "Show preview"}
            >
              <span className="icon is-small">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {expanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </span>
            </button>
          )}
          
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
      </div>

      {/* Expandable PDF Preview */}
      {expanded && file.type === 'application/pdf' && file.thumbnail && (
        <div className="mt-3 pdf-preview-container" style={{ height: '400px', width: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid #eee' }}>
          <object
            data={file.thumbnail}
            type="application/pdf"
            style={{ width: '100%', height: '100%', border: 'none' }}
          >
            <div className="has-text-centered p-6">
              <p>Unable to display PDF preview</p>
            </div>
          </object>
        </div>
      )}
    </li>
  );
}
