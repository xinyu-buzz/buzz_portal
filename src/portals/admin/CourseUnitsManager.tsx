import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TestQuestionsManager } from "./TestQuestionsManager";
import { PracticalTestCriteriaManager } from "./PracticalTestCriteriaManager";
import SlidePresentation from "../../components/slideshow/SlidePresentation";

const MATERIAL_ITEM_TYPE = "MATERIAL_ITEM";
const SECTION_ITEM_TYPE = "SECTION_ITEM";
const UNIT_ITEM_TYPE = "UNIT_ITEM";
const TEST_ITEM_TYPE = "TEST_ITEM";

type DraggablePDFItemProps = {
  index: number;
  url: string;
  name: string;
  type: string;
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  bulkSelectionMode?: boolean;
  selectedMaterials?: Set<number>;
  onToggleSelection?: (index: number) => void;
  partAssignment?: string; // Added to track which part this material is assigned to
  materialPartNames?: string[];
  onAssignToPart?: (materialIndex: number, partIndex: number) => void;
};

const DraggablePDFItem = ({ index, url, name, type, onNameChange, onRemove, onMove, bulkSelectionMode, selectedMaterials, onToggleSelection, partAssignment, materialPartNames, onAssignToPart }: DraggablePDFItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: MATERIAL_ITEM_TYPE,
    item: { index, partAssignment },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: MATERIAL_ITEM_TYPE,
    hover: (item: { index: number; partAssignment?: string }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // Only allow hover reordering if both items are in the same part/context
      if (item.partAssignment !== partAssignment) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        padding: '12px',
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.2)' : 'rgba(107, 140, 174, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(107, 140, 174, 0.3)',
        marginBottom: '8px',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {/* Bulk selection checkbox or drag handle */}
        {bulkSelectionMode ? (
          <input
            type="checkbox"
            checked={selectedMaterials?.has(index) || false}
            onChange={() => onToggleSelection?.(index)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              cursor: 'grab',
              padding: '4px',
              color: '#9ca3b5',
            }}
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮⋮</span>
          </div>
        )}

        {/* PDF icon */}
        <span style={{ fontSize: '24px' }}>📄</span>

        {/* Editable name input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(index, e.target.value)}
            className="text-input"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              marginBottom: '4px',
            }}
            placeholder="Enter material name"
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: '#6b8cae',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              View Material
            </a>
            {partAssignment === 'unassigned' && materialPartNames && materialPartNames.length > 0 && onAssignToPart && (
              <select
                value=""
                onChange={(e) => {
                  const partIndex = parseInt(e.target.value);
                  if (!isNaN(partIndex) && partIndex >= 0) {
                    onAssignToPart(index, partIndex);
                  }
                  e.target.value = ''; // Reset select after selection
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '11px',
                  padding: '2px 4px',
                  border: '1px solid #6b8cae',
                  borderRadius: '3px',
                  backgroundColor: 'white',
                  color: '#6b8cae',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>Move to part...</option>
                {materialPartNames.map((partName, partIndex) => (
                  <option key={partIndex} value={partIndex}>
                    {partName || `Part ${partIndex + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Material type and Remove button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              color: '#6b8cae',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {type}
          </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Remove
        </button>
        </div>
      </div>
    </div>
  );
};

type DraggableVideoItemProps = {
  index: number;
  url: string;
  name: string;
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  bulkSelectionMode?: boolean;
  selectedMaterials?: Set<number>;
  onToggleSelection?: (index: number) => void;
  partAssignment?: string; // Added to track which part this material is assigned to
  materialPartNames?: string[];
  onAssignToPart?: (materialIndex: number, partIndex: number) => void;
};

const DraggableVideoItem = ({ index, url, name, onNameChange, onRemove, onMove, bulkSelectionMode, selectedMaterials, onToggleSelection, partAssignment, materialPartNames, onAssignToPart }: DraggableVideoItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: MATERIAL_ITEM_TYPE,
    item: { index, partAssignment },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: MATERIAL_ITEM_TYPE,
    hover: (item: { index: number; partAssignment?: string }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // Only allow hover reordering if both items are in the same part/context
      if (item.partAssignment !== partAssignment) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));
  preview(ref);

  return (
    <div
      ref={ref}
      style={{
        padding: '12px',
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.2)' : 'rgba(107, 140, 174, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(107, 140, 174, 0.3)',
        marginBottom: '8px',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {/* Bulk selection checkbox or drag handle */}
        {bulkSelectionMode ? (
          <input
            type="checkbox"
            checked={selectedMaterials?.has(index) || false}
            onChange={() => onToggleSelection?.(index)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              cursor: 'grab',
              padding: '4px',
              color: '#9ca3b5',
            }}
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮⋮</span>
          </div>
        )}

        {/* Video icon */}
        <span style={{ fontSize: '24px' }}>🎬</span>

        {/* Editable name input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(index, e.target.value)}
            className="text-input"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              marginBottom: '4px',
            }}
            placeholder="Enter video name"
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: '#6b8cae',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              View Video
            </a>
            {partAssignment === 'unassigned' && materialPartNames && materialPartNames.length > 0 && onAssignToPart && (
              <select
                value=""
                onChange={(e) => {
                  const partIndex = parseInt(e.target.value);
                  if (!isNaN(partIndex) && partIndex >= 0) {
                    onAssignToPart(index, partIndex);
                  }
                  e.target.value = ''; // Reset select after selection
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '11px',
                  padding: '2px 4px',
                  border: '1px solid #6b8cae',
                  borderRadius: '3px',
                  backgroundColor: 'white',
                  color: '#6b8cae',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>Move to part...</option>
                {materialPartNames.map((partName, partIndex) => (
                  <option key={partIndex} value={partIndex}>
                    {partName || `Part ${partIndex + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Material type and Remove button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              color: '#6b8cae',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            VIDEO
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

type DraggableQuestionItemProps = {
  question: ReviewQuestion;
  index: number;
  name: string;
  onNameChange: (index: number, name: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  bulkSelectionMode?: boolean;
  selectedMaterials?: Set<number>;
  onToggleSelection?: (index: number) => void;
  partAssignment?: string; // Added to track which part this material is assigned to
  materialPartNames?: string[];
  onAssignToPart?: (materialIndex: number, partIndex: number) => void;
};

const DraggableQuestionItem = ({ question, index, name, onNameChange, onEdit, onDelete, onMove, bulkSelectionMode, selectedMaterials, onToggleSelection, partAssignment, materialPartNames, onAssignToPart }: DraggableQuestionItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: MATERIAL_ITEM_TYPE,
    item: { index, partAssignment },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: MATERIAL_ITEM_TYPE,
    hover: (item: { index: number; partAssignment?: string }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // Only allow hover reordering if both items are in the same part/context
      if (item.partAssignment !== partAssignment) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        marginBottom: '12px',
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'rgba(107, 140, 174, 0.1)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid rgba(107, 140, 174, 0.3)',
        cursor: 'grab',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {/* Bulk selection checkbox or drag handle */}
        {bulkSelectionMode ? (
          <input
            type="checkbox"
            checked={selectedMaterials?.has(index) || false}
            onChange={() => onToggleSelection?.(index)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              cursor: 'grab',
              padding: '4px',
              color: '#9ca3b5',
            }}
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮⋮</span>
          </div>
        )}

        {/* Question icon */}
        <span style={{ fontSize: '24px' }}>✏️</span>

        {/* Editable name input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(index, e.target.value)}
            className="text-input"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              marginBottom: '4px',
            }}
            placeholder="Enter question name"
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ fontSize: '12px', color: '#9ca3b5' }}>
            Q{index + 1}: {question.question_text}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: '#9ca3b5' }}>
              {question.options.length} options • Correct: {question.options[question.correct_answer_index]}
            </div>
            {partAssignment === 'unassigned' && materialPartNames && materialPartNames.length > 0 && onAssignToPart && (
              <select
                value=""
                onChange={(e) => {
                  const partIndex = parseInt(e.target.value);
                  if (!isNaN(partIndex) && partIndex >= 0) {
                    onAssignToPart(index, partIndex);
                  }
                  e.target.value = ''; // Reset select after selection
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '11px',
                  padding: '2px 4px',
                  border: '1px solid #6b8cae',
                  borderRadius: '3px',
                  backgroundColor: 'white',
                  color: '#6b8cae',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>Move to part...</option>
                {materialPartNames.map((partName, partIndex) => (
                  <option key={partIndex} value={partIndex}>
                    {partName || `Part ${partIndex + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onEdit}
            style={{
              backgroundColor: 'rgba(107, 140, 174, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const PREVIEW_ITEM_TYPE = "PREVIEW_ITEM";

type DraggablePreviewItemProps = {
  index: number;
  item: {
    name: string;
    type: 'pdf' | 'image' | 'video';
    previewUrl?: string;
    status: 'uploading' | 'completed' | 'error';
  };
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggablePreviewItem = ({ index, item, onMove }: DraggablePreviewItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: PREVIEW_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: PREVIEW_ITEM_TYPE,
    hover: (draggedItem: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the item's height or width
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      draggedItem.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: '140px',
        opacity: isDragging ? 0.5 : 1,
        cursor: item.status === 'completed' ? 'grab' : 'default',
        pointerEvents: item.status === 'completed' ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          width: '140px',
          height: '140px',
          borderRadius: '8px',
          backgroundColor: isOver ? 'rgba(107, 140, 174, 0.3)' : 'rgba(255, 255, 255, 0.05)',
          border: `2px solid ${isOver ? 'rgba(107, 140, 174, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {item.type === 'image' && item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : item.type === 'video' && item.previewUrl ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              src={item.previewUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '32px',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              🎬
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#9ca3b5',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 4px',
        }}
      >
        {item.name}
      </div>
    </div>
  );
};

type DroppableUnassignedContainerProps = {
  children: React.ReactNode;
  onMaterialDropped: (materialIndex: number) => void;
  materialCount: number;
};

const DroppableUnassignedContainer = ({
  children,
  onMaterialDropped,
  materialCount
}: DroppableUnassignedContainerProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: MATERIAL_ITEM_TYPE,
    drop: (item: { index: number }) => {
      onMaterialDropped(item.index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drop(ref);

  return (
    <div
      ref={ref}
      style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: isOver ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)',
        borderRadius: '8px',
        border: `2px solid ${isOver ? 'rgba(255, 193, 7, 0.5)' : 'rgba(255, 193, 7, 0.3)'}`,
        transition: 'all 0.2s ease',
        minHeight: '80px'
      }}
    >
      <h5 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#856404' }}>
        Unassigned Materials
        <span style={{ fontSize: '12px', color: '#856404', marginLeft: '8px' }}>
          ({materialCount} material{materialCount !== 1 ? 's' : ''})
        </span>
      </h5>

      {isOver && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#856404',
          fontSize: '14px',
          fontWeight: 500
        }}>
          Drop material here to unassign
        </div>
      )}

      {children}
    </div>
  );
};

type DroppablePartContainerProps = {
  partIndex: number;
  partName: string;
  children: React.ReactNode;
  onMaterialDropped: (materialIndex: number, partIndex: number) => void;
  materialCount: number;
  onPartNameChange: (partIndex: number, name: string) => void;
  onRemovePart: (partIndex: number) => void;
  onMovePart: (partIndex: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: (partIndex: number) => void;
  onPreviewPart: (partIndex: number) => void;
  onAddMaterial: (partIndex: number) => void;
  showDropdown: boolean;
  showPartDropdown: boolean;
  onTogglePartDropdown: (partIndex: number | null) => void;
  onOpenUploadModal: (type: 'pdf' | 'video' | 'question', partIndex: number) => void;
};

const DroppablePartContainer = ({
  partIndex,
  partName,
  children,
  onMaterialDropped,
  materialCount,
  onPartNameChange,
  onRemovePart,
  onMovePart,
  isCollapsed,
  onToggleCollapse,
  onPreviewPart,
  onAddMaterial,
  showDropdown,
  showPartDropdown,
  onTogglePartDropdown,
  onOpenUploadModal
}: DroppablePartContainerProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onTogglePartDropdown(null);
      }
    };

    if (showPartDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPartDropdown, onTogglePartDropdown]);

  const [{ isOver }, drop] = useDrop({
    accept: MATERIAL_ITEM_TYPE,
    drop: (item: { index: number }) => {
      onMaterialDropped(item.index, partIndex);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drop(ref);

  return (
    <div
      ref={ref}
      style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'rgba(107, 140, 174, 0.05)',
        borderRadius: '8px',
        border: `2px solid ${isOver ? 'rgba(107, 140, 174, 0.5)' : 'rgba(107, 140, 174, 0.2)'}`,
        transition: 'all 0.2s ease',
        minHeight: isCollapsed ? 'auto' : '100px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? '0' : '12px' }}>
        <input
          type="text"
          value={partName}
          onChange={(e) => onPartNameChange(partIndex, e.target.value)}
          style={{
            fontSize: '16px',
            fontWeight: 600,
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px 8px',
            backgroundColor: 'white',
            color: '#6b8cae'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>
            Materials: {materialCount}
          </span>
          <button
            type="button"
            onClick={() => onToggleCollapse(partIndex)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#6b8cae',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '32px'
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
          <button
            type="button"
            onClick={() => onPreviewPart(partIndex)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            disabled={materialCount === 0}
            title="Preview materials in this part"
          >
            Preview
          </button>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => onTogglePartDropdown(showPartDropdown ? null : partIndex)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6b8cae',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              More
            </button>
            {showPartDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: '120px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onMovePart(partIndex);
                    onTogglePartDropdown(null);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    color: '#333',
                    border: 'none',
                    borderRadius: '4px 4px 0 0',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  Move Part
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemovePart(partIndex);
                    onTogglePartDropdown(null);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    color: '#dc3545',
                    border: 'none',
                    borderRadius: '0 0 4px 4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  Remove Part
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Add Material in this Part Button */}
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <button
              type="button"
              onClick={() => onAddMaterial(partIndex)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b8cae',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>+</span>
              <span>Add Material in this Part</span>
            </button>

            {/* Dropdown menu for material type selection */}
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  minWidth: '160px',
                  overflow: 'hidden'
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpenUploadModal('pdf', partIndex)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  📄 PDF / Image
                </button>
                <button
                  type="button"
                  onClick={() => onOpenUploadModal('video', partIndex)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    border: 'none',
                    borderTop: '1px solid #f3f4f6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  🎬 Video
                </button>
                <button
                  type="button"
                  onClick={() => onOpenUploadModal('question', partIndex)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    border: 'none',
                    borderTop: '1px solid #f3f4f6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  ❓ Review Question
                </button>
              </div>
            )}
          </div>

          {isOver && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#6b8cae',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Drop material here to assign to {partName}
            </div>
          )}

          {children}
        </>
      )}
    </div>
  );
};

type DraggableSectionItemProps = {
  section: CourseSection;
  index: number;
  unitsCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggableSectionItem = ({ section, index, unitsCount, onEdit, onDelete, onMove }: DraggableSectionItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: SECTION_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: SECTION_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'transparent',
        cursor: 'grab',
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          <span>{section.display_order}</span>
        </div>
      </td>
      <td>{section.name}</td>
      <td>{section.description || "-"}</td>
      <td>{unitsCount}</td>
      <td>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

type DraggableUnitItemProps = {
  unit: CourseUnit;
  index: number;
  sectionName: string;
  prerequisitesText: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  isFirstInSection: boolean;
  sectionColor: string;
};

const DraggableUnitItem = ({ unit, index, sectionName, prerequisitesText, onEdit, onDelete, onMove, isFirstInSection, sectionColor }: DraggableUnitItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: UNIT_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: UNIT_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : sectionColor,
        cursor: 'grab',
        borderTop: isFirstInSection && index > 0 ? '2px solid rgba(107, 140, 174, 0.4)' : undefined,
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          {unit.title}
        </div>
      </td>
      <td>{sectionName}</td>
      <td>{prerequisitesText}</td>
      <td>{unit.is_mandatory ? "Yes" : "No"}</td>
      <td>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

type DraggableTestItemProps = {
  test: CourseTest;
  index: number;
  sectionName: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onManageQuestions?: () => void;
};

const DraggableTestItem = ({ test, index, sectionName, onEdit, onDelete, onMove, onManageQuestions }: DraggableTestItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: TEST_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: TEST_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'transparent',
        cursor: 'grab',
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          <span>{test.order_index}</span>
        </div>
      </td>
      <td>{test.test_name}</td>
      <td style={{ textTransform: "capitalize" }}>
        {test.test_type.replace("_", " ")}
      </td>
      <td>{test.passing_score}%</td>
      <td>{sectionName}</td>
      <td>
        {test.required_units && test.required_units.length > 0
          ? test.required_units.sort((a, b) => a - b).join(", ")
          : "None"}
      </td>
      <td>{test.required_for_progression ? "Yes" : "No"}</td>
      <td>{test.needs_proctor ? "Yes" : "No"}</td>
      <td>{test.is_active ? "Yes" : "No"}</td>
      <td>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onEdit}
          >
            Edit
          </button>
          {(test.test_type === "multiple_choice" || test.test_type === "practical") && onManageQuestions && (
            <button
              className="primary-btn"
              style={{ padding: "6px 10px", fontSize: 12, backgroundColor: '#6b8cae', whiteSpace: "nowrap" }}
              onClick={onManageQuestions}
            >
              More
            </button>
          )}
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

type CourseSection = {
  id: string;
  course_id: string;
  name: string;
  display_order: number;
  description: string | null;
  section_type: string;
  requires_subscription: boolean;
  requires_test_passed: boolean;
  prerequisite_section_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  exam_type: string | null;
};

type ReviewQuestion = {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
};

type CourseUnit = {
  id: string;
  course_id: string;
  unit_number: number;
  title: string;
  description: string | null;
  content: string | null;
  step_number: number | null;
  is_mandatory: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  pdf_url?: any; // Legacy field, kept for backward compatibility
  pdf_names?: string[] | null; // Legacy field, kept for backward compatibility
  material_urls: string[] | null;
  material_names: string[] | null;
  material_types: string[] | null;
  material_part_names: string[] | null;
  material_parts: string[] | null;
  // video_urls, video_names, review_questions are deprecated - now stored in unified material_* arrays
  section_id: string | null;
  prerequisite_units: number[];
  prerequisite_tests: string[];
};

type TrainingCourse = {
  id: string;
  title: string;
  provider: string;
  region?: string;
  category?: string;
  active?: boolean;
};

type CourseTest = {
  id: string;
  course_id: string;
  test_name: string;
  test_description: string | null;
  test_type: "multiple_choice" | "practical" | "written" | "oral";
  passing_score: number;
  required_for_progression: boolean;
  required_units: number[];
  order_index: number;
  questions: any;
  is_active: boolean;
  section_id: string | null;
  needs_proctor: boolean;
  duration: number;
  price_of_schedule: number | null; // Stored in cents (e.g., 4999 = $49.99)
  created_at: string;
  updated_at: string;
};

const TEST_TYPES = ["multiple_choice", "practical", "written", "oral"] as const;

export const CourseUnitsManager = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [tests, setTests] = useState<CourseTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [showQuestionsManager, setShowQuestionsManager] = useState(false);
  const [managingTest, setManagingTest] = useState<CourseTest | null>(null);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);
  const [editingTest, setEditingTest] = useState<CourseTest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Array<{file: File, name: string, type: 'pdf' | 'image' | 'video', targetPart?: number}>>([]);
  const [materialUrls, setMaterialUrls] = useState<string[]>([]);
  const [materialNames, setMaterialNames] = useState<string[]>([]);
  const [materialTypes, setMaterialTypes] = useState<string[]>([]);
  const [materialPartNames, setMaterialPartNames] = useState<string[]>([]);
  const [materialParts, setMaterialParts] = useState<string[]>([]);
  const [collapsedParts, setCollapsedParts] = useState<Set<number>>(new Set());
  const [previewPartIndex, setPreviewPartIndex] = useState<number | null>(null);
  const [previewMaterials, setPreviewMaterials] = useState<Array<{
    name: string;
    type: 'pdf' | 'image' | 'video' | 'question';
    url: string;
  }>>([]);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showMaterialTypeDropdown, setShowMaterialTypeDropdown] = useState(false);
  const [showMaterialUploadModal, setShowMaterialUploadModal] = useState(false);
  const [materialUploadType, setMaterialUploadType] = useState<'pdf' | 'video' | 'question' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [targetPartIndex, setTargetPartIndex] = useState<number | null>(null);
  const [showPartMaterialDropdown, setShowPartMaterialDropdown] = useState<number | null>(null);
  const [showPartDropdown, setShowPartDropdown] = useState<number | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    name: string,
    progress: number,
    status: 'uploading' | 'completed' | 'error',
    error?: string,
    file: File,
    previewUrl?: string,
    uploadedUrl?: string,
    type: 'pdf' | 'image' | 'video'
  }>>([]);
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'reordering'>('uploading');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showUnsavedChangesWarning, setShowUnsavedChangesWarning] = useState(false);
  const [initialUnitForm, setInitialUnitForm] = useState<any>(null);
  const [initialMaterials, setInitialMaterials] = useState<{
    materialUrls: string[],
    materialNames: string[],
    materialTypes: string[],
    materialPartNames: string[],
    materialParts: string[]
  } | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    options: ["", "", "", ""],
    correct_answer_index: 0,
    explanation: "",
  });
  const [allCourses, setAllCourses] = useState<TrainingCourse[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: 'unit' | 'test'; item: CourseUnit | CourseTest } | null>(null);
  const [showRemovePartWarningModal, setShowRemovePartWarningModal] = useState(false);
  const [partToRemove, setPartToRemove] = useState<number | null>(null);
  const [showMovePartModal, setShowMovePartModal] = useState(false);
  const [partToMove, setPartToMove] = useState<number | null>(null);
  const [targetUnitForMove, setTargetUnitForMove] = useState<string>("");
  const [targetCourseId, setTargetCourseId] = useState<string>("");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<number>>(new Set());
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

  const [sectionForm, setSectionForm] = useState({
    name: "",
    description: "",
    display_order: 0,
  });

  const [unitForm, setUnitForm] = useState({
    title: "",
    description: "",
    content: "",
    order_index: 0,
    is_mandatory: false,
    section_id: "",
    prerequisite_units: [] as number[],
    prerequisite_tests: [] as string[],
  });

  const [testForm, setTestForm] = useState({
    test_name: "",
    test_description: "",
    test_type: "multiple_choice" as "multiple_choice" | "practical" | "written" | "oral",
    passing_score: 70,
    required_for_progression: true,
    required_units: [] as number[],
    order_index: 0,
    is_active: true,
    section_id: "",
    needs_proctor: false,
    duration: 60,
    price_of_schedule: null as number | null,
  });

  useEffect(() => {
    if (courseId) {
      loadData();
      loadAllCourses();
    }
  }, [courseId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMaterialTypeDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.material-dropdown-container')) {
          setShowMaterialTypeDropdown(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMaterialTypeDropdown]);

  // Handle browser beforeunload to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showUnitForm && hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showUnitForm, unitForm, materialUrls, materialNames, materialTypes, materialPartNames, materialParts, initialUnitForm, initialMaterials]);

  const loadData = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);

    try {
      // Load course
      const { data: courseData, error: courseError } = await supabaseClient
        .from("training_courses")
        .select("id, title, provider, region, active, category")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      
      if (courseData.provider !== "Buzz") {
        setError("This page is only available for Buzz courses.");
        setLoading(false);
        return;
      }

      setCourse(courseData);

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabaseClient
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("display_order", { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // Load units
      const { data: unitsData, error: unitsError } = await supabaseClient
        .from("course_units")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });

      if (unitsError) throw unitsError;
      setUnits(unitsData || []);

      // Load tests
      const { data: testsData, error: testsError } = await supabaseClient
        .from("course_tests")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });

      if (testsError) throw testsError;
      setTests(testsData || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    }

    setLoading(false);
  };

  const loadAllCourses = async () => {
    try {
      const { data, error: coursesError } = await supabaseClient
        .from("training_courses")
        .select("id, title, provider")
        .eq("provider", "Buzz")
        .is("deleted_at", null)
        .order("title", { ascending: true });

      if (coursesError) throw coursesError;
      setAllCourses(data || []);
    } catch (err: any) {
      console.error("Error loading courses:", err);
    }
  };

  // Section handlers
  const openSectionForm = (section?: CourseSection) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({
        name: section.name,
        description: section.description || "",
        display_order: section.display_order,
      });
    } else {
      setEditingSection(null);
      setSectionForm({
        name: "",
        description: "",
        display_order: sections.length + 1,
      });
    }
    setShowSectionForm(true);
  };

  const closeSectionForm = () => {
    setShowSectionForm(false);
    setEditingSection(null);
    setSectionForm({
      name: "",
      description: "",
      display_order: 0,
    });
    setError(null);
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      if (editingSection) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_sections")
          .update({
            name: sectionForm.name,
            description: sectionForm.description,
            display_order: sectionForm.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSection.id);

        if (updateError) throw updateError;
      } else {
        // Create
        const { error: insertError } = await supabaseClient
          .from("course_sections")
          .insert({
            course_id: courseId,
            name: sectionForm.name,
            description: sectionForm.description,
            display_order: sectionForm.display_order,
          });

        if (insertError) throw insertError;
      }

      closeSectionForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving section:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Are you sure you want to delete this section?\n\nThis will move the section to the recycle bin.\n\nItems in the recycle bin will be permanently deleted after 30 days.\n\nYou can restore items from the recycle bin if needed.")) return;

    try {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session?.session?.user?.id;
      const now = new Date().toISOString();

      const { error: deleteError } = await supabaseClient
        .from("course_sections")
        .update({ deleted_at: now, deleted_by: userId })
        .eq("id", sectionId);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error("Error deleting section:", err);
      setError(err.message);
    }
  };

  // Unit handlers
  const openUnitForm = (unit?: CourseUnit) => {
    if (unit) {
      setEditingUnit(unit);
      const unitFormData = {
        title: unit.title,
        description: unit.description || "",
        content: unit.content || "",
        order_index: unit.order_index,
        is_mandatory: unit.is_mandatory,
        section_id: unit.section_id || "",
        prerequisite_units: unit.prerequisite_units || [],
        prerequisite_tests: unit.prerequisite_tests || [],
      };
      setUnitForm(unitFormData);

      // Load material data - prioritize new columns, fallback to legacy columns for backward compatibility
      let urls: string[] = [];
      let names: string[] = [];
      let types: string[] = [];

      if (unit.material_urls && Array.isArray(unit.material_urls) && unit.material_urls.length > 0) {
        // Use new columns - all materials stored in unified arrays
        urls = unit.material_urls;
        names = Array.isArray(unit.material_names) ? unit.material_names : urls.map((_, i) => `Material ${i + 1}`);
        types = Array.isArray(unit.material_types) ? unit.material_types : urls.map(() => 'pdf');
      } else if (unit.pdf_url) {
        // Fallback to legacy columns
        urls = Array.isArray(unit.pdf_url) ? unit.pdf_url : [unit.pdf_url];
        names = Array.isArray(unit.pdf_names) ? unit.pdf_names : urls.map((_, i) => `Material ${i + 1}`);
        types = urls.map(() => 'pdf');
      }

      // Ensure materialParts has the same length as materialUrls
      let parts = Array.isArray(unit.material_parts) ? unit.material_parts : [];
      if (parts.length < urls.length) {
        parts = [...parts, ...new Array(urls.length - parts.length).fill('')];
      } else if (parts.length > urls.length) {
        parts = parts.slice(0, urls.length);
      }

      setMaterialUrls(urls);
      setMaterialNames(names);
      setMaterialTypes(types);
      const partNames = Array.isArray(unit.material_part_names) ? unit.material_part_names : [];
      setMaterialPartNames(partNames);
      setMaterialParts(parts);
      // Set all parts as collapsed by default
      setCollapsedParts(new Set(partNames.map((_, index) => index)));
      setPendingFiles([]);

      // Save initial state for change detection
      setInitialUnitForm(unitFormData);
      setInitialMaterials({
        materialUrls: urls,
        materialNames: names,
        materialTypes: types,
        materialPartNames: partNames,
        materialParts: parts
      });
    } else {
      setEditingUnit(null);
      const unitFormData = {
        title: "",
        description: "",
        content: "",
        order_index: units.length + 1,
        is_mandatory: false,
        section_id: "",
        prerequisite_units: [],
        prerequisite_tests: [],
      };
      setUnitForm(unitFormData);
      setMaterialUrls([]);
      setMaterialNames([]);
      setMaterialTypes([]);
      setMaterialPartNames([]);
      setMaterialParts([]);
      setPendingFiles([]);

      // Save initial state for change detection (empty for new units)
      setInitialUnitForm(unitFormData);
      setInitialMaterials({
        materialUrls: [],
        materialNames: [],
        materialTypes: [],
        materialPartNames: [],
        materialParts: []
      });
    }
    setShowUnitForm(true);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!initialUnitForm || !initialMaterials || !showUnitForm) return false;

    try {
      // Check unit form changes
      const unitFormChanged = JSON.stringify(unitForm) !== JSON.stringify(initialUnitForm);

      // Check material changes
      const materialsChanged =
        JSON.stringify(materialUrls) !== JSON.stringify(initialMaterials.materialUrls) ||
        JSON.stringify(materialNames) !== JSON.stringify(initialMaterials.materialNames) ||
        JSON.stringify(materialTypes) !== JSON.stringify(initialMaterials.materialTypes) ||
        JSON.stringify(materialPartNames) !== JSON.stringify(initialMaterials.materialPartNames) ||
        JSON.stringify(materialParts) !== JSON.stringify(initialMaterials.materialParts);

      return unitFormChanged || materialsChanged;
    } catch (error) {
      // If JSON stringify fails, fall back to length comparison
      console.warn('Error in hasUnsavedChanges comparison:', error);
      return (
        unitForm.title !== initialUnitForm.title ||
        unitForm.description !== initialUnitForm.description ||
        unitForm.content !== initialUnitForm.content ||
        materialUrls.length !== initialMaterials.materialUrls.length ||
        materialNames.length !== initialMaterials.materialNames.length ||
        materialTypes.length !== initialMaterials.materialTypes.length
      );
    }
  };

  const closeUnitForm = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedChangesWarning(true);
    } else {
      performCloseUnitForm();
    }
  };

  const performCloseUnitForm = () => {
    setShowUnitForm(false);
    setEditingUnit(null);
    setUnitForm({
      title: "",
      description: "",
      content: "",
      order_index: 0,
      is_mandatory: false,
      section_id: "",
      prerequisite_units: [],
      prerequisite_tests: [],
    });
    setMaterialUrls([]);
    setMaterialNames([]);
    setMaterialTypes([]);
    setMaterialPartNames([]);
    setMaterialParts([]);
    setPendingFiles([]);
    setInitialUnitForm(null);
    setInitialMaterials(null);
    setError(null);
    // Reset initial state tracking
    setInitialUnitForm(null);
    setInitialMaterials(null);
  };

  // Material upload modal handlers
  const openMaterialUploadModal = (type: 'pdf' | 'video' | 'question', partIndex: number | null = null) => {
    if (type === 'question') {
      // Directly open question modal for questions
      setTargetPartIndex(partIndex);
      openQuestionModal();
    } else {
      setMaterialUploadType(type);
      setTargetPartIndex(partIndex);
      setShowMaterialUploadModal(true);
    }
    setShowMaterialTypeDropdown(false);
    setShowPartMaterialDropdown(null);
  };

  const closeMaterialUploadModal = () => {
    setShowMaterialUploadModal(false);
    setMaterialUploadType(null);
    setTargetPartIndex(null);
    setIsDragging(false);
    setUploadingFiles([]);
    setUploadPhase('uploading');
    // Don't clear files here - they might be in pending state
  };

  // Handle reordering of preview items
  const movePreviewItem = useCallback((dragIndex: number, hoverIndex: number) => {
    setUploadingFiles(prev => {
      const updated = [...prev];
      const draggedItem = updated[dragIndex];
      updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedItem);
      return updated;
    });
  }, []);

  const movePreviewMaterial = useCallback((dragIndex: number, hoverIndex: number) => {
    setPreviewMaterials(prev => {
      const updated = [...prev];
      const draggedItem = updated[dragIndex];
      updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedItem);
      return updated;
    });
  }, []);

  // Convert previewMaterials to CourseMaterial format for slideshow
  const getSlideshowMaterials = useCallback((): Array<{
    index: number;
    name: string;
    url: string;
    type: string;
    isVideo: boolean;
    isImage: boolean;
    isPDF: boolean;
    isQuestion?: boolean;
  }> => {
    return previewMaterials.map((material, index) => ({
      index,
      name: material.name,
      url: material.url,
      type: material.type,
      isVideo: material.type === 'video',
      isImage: material.type === 'image',
      isPDF: material.type === 'pdf',
      isQuestion: material.type === 'question'
    }));
  }, [previewMaterials]);

  // Create unit data for slideshow
  const getSlideshowUnit = useCallback(() => {
    const partName = previewPartIndex !== null ? materialPartNames[previewPartIndex] : 'Preview';
    return {
      id: `preview-part-${previewPartIndex}`,
      title: partName,
      content: `Preview of materials in ${partName}`,
      unit_number: (previewPartIndex || 0) + 1
    };
  }, [previewPartIndex, materialPartNames]);

  const handleSlideshowComplete = useCallback(() => {
    setShowSlideshow(false);
    // Could add completion handling here if needed
  }, []);

  // Handle confirming the upload order and adding to materials
  const handleConfirmUploadOrder = () => {
    // Add materials in the order they appear in uploadingFiles
    uploadingFiles.forEach(uploadedFile => {
      if (uploadedFile.status === 'completed' && uploadedFile.uploadedUrl) {
        const materialName = uploadedFile.name.replace(/\.(pdf|jpe?g|png|gif|webp|bmp|svg|mp4|mov|avi|mkv|webm)$/i, '');
        
        setMaterialUrls(prev => [...prev, uploadedFile.uploadedUrl!]);
        setMaterialNames(prev => [...prev, materialName]);
        setMaterialTypes(prev => [...prev, uploadedFile.type]);
        
        // Assign to target part if specified
        if (targetPartIndex !== null) {
          setMaterialParts(prev => [...prev, (targetPartIndex + 1).toString()]);
        } else {
          setMaterialParts(prev => [...prev, '']);
        }
      }
    });

    // Clean up preview URLs
    uploadingFiles.forEach(file => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });

    // Close the modal
    closeMaterialUploadModal();
  };

  // Remove part warning modal handlers
  const openRemovePartWarningModal = (partIndex: number) => {
    setPartToRemove(partIndex);
    setShowRemovePartWarningModal(true);
  };

  const closeRemovePartWarningModal = () => {
    setShowRemovePartWarningModal(false);
    setPartToRemove(null);
  };

  // Move part modal handlers
  const openMovePartModal = (partIndex: number) => {
    setPartToMove(partIndex);
    setTargetUnitForMove("");
    setShowMovePartModal(true);
  };

  const closeMovePartModal = () => {
    setShowMovePartModal(false);
    setPartToMove(null);
    setTargetUnitForMove("");
  };

  const movePartToUnit = async () => {
    if (partToMove === null || !targetUnitForMove || !editingUnit) return;

    setSubmitting(true);
    setError(null);

    try {
      // Get the target unit
      const targetUnit = units.find(u => u.id === targetUnitForMove);
      if (!targetUnit) {
        setError("Target unit not found");
        return;
      }

      // Get current part data
      const partName = materialPartNames[partToMove];
      const partNumber = (partToMove + 1).toString();

      // Collect materials assigned to this part
      const materialsToMove: { index: number, url: string, name: string, type: string }[] = [];
      for (let i = 0; i < materialUrls.length; i++) {
        if (materialParts[i] === partNumber) {
          materialsToMove.push({
            index: i,
            url: materialUrls[i],
            name: materialNames[i],
            type: materialTypes[i]
          });
        }
      }

      // Remove part from current unit
      const updatedPartNames = materialPartNames.filter((_, i) => i !== partToMove);
      const updatedParts = materialParts.map(part => {
        const currentPartNum = parseInt(part);
        if (currentPartNum === parseInt(partNumber)) {
          return ''; // Unassign materials from this part
        } else if (currentPartNum > parseInt(partNumber)) {
          return (currentPartNum - 1).toString(); // Shift down part numbers
        }
        return part;
      });

      // Update current unit
      const currentUnitPayload = {
        material_part_names: updatedPartNames.length > 0 ? updatedPartNames : [],
        material_parts: updatedParts.length > 0 ? updatedParts : [],
        updated_at: new Date().toISOString(),
      };

      const { error: currentUpdateError } = await supabaseClient
        .from("course_units")
        .update(currentUnitPayload)
        .eq("id", editingUnit.id);

      if (currentUpdateError) throw currentUpdateError;

      // Add part to target unit
      const targetPartNames = targetUnit.material_part_names || [];
      const targetParts = targetUnit.material_parts || [];
      const targetUrls = targetUnit.material_urls || [];
      const targetNames = targetUnit.material_names || [];
      const targetTypes = targetUnit.material_types || [];

      // Add the part name
      const newPartIndex = targetPartNames.length;
      const newPartNumber = (newPartIndex + 1).toString();
      const updatedTargetPartNames = [...targetPartNames, partName];

      // Add materials to target unit
      const updatedTargetUrls = [...targetUrls];
      const updatedTargetNames = [...targetNames];
      const updatedTargetTypes = [...targetTypes];
      const updatedTargetParts = [...targetParts];

      materialsToMove.forEach(material => {
        updatedTargetUrls.push(material.url);
        updatedTargetNames.push(material.name);
        updatedTargetTypes.push(material.type);
        updatedTargetParts.push(newPartNumber);
      });

      // Update target unit
      const targetUnitPayload = {
        material_part_names: updatedTargetPartNames.length > 0 ? updatedTargetPartNames : [],
        material_urls: updatedTargetUrls.length > 0 ? updatedTargetUrls : [],
        material_names: updatedTargetNames.length > 0 ? updatedTargetNames : [],
        material_types: updatedTargetTypes.length > 0 ? updatedTargetTypes : [],
        material_parts: updatedTargetParts.length > 0 ? updatedTargetParts : [],
        updated_at: new Date().toISOString(),
      };

      const { error: targetUpdateError } = await supabaseClient
        .from("course_units")
        .update(targetUnitPayload)
        .eq("id", targetUnit.id);

      if (targetUpdateError) throw targetUpdateError;

      // Update local state
      setMaterialPartNames(updatedPartNames);
      setMaterialParts(updatedParts);

      // Close modal and reload data
      closeMovePartModal();
      await loadData();

      setError(null);
    } catch (err: any) {
      console.error("Error moving part:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  // Drag and drop handlers for file uploads
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Initialize upload tracking for all files with extended structure
      const fileArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const fileType = materialUploadType === 'pdf' ? 'pdf' : 'video'; // Determine base type

      setUploadingFiles(fileArray.map(f => {
        const actualType = f.type === 'application/pdf' ? 'pdf' : 
                          f.type.startsWith('image/') ? 'image' : 'video';
        const previewUrl = actualType === 'image' || actualType === 'video' ? URL.createObjectURL(f) : undefined;
        
        return {
          name: f.name,
          progress: 0,
          status: 'uploading' as const,
          file: f,
          previewUrl,
          type: actualType
        };
      }));
      
      setUploadPhase('uploading');
      
      // Handle multiple files - upload them sequentially
      for (let i = 0; i < fileArray.length; i++) {
        await handleFileUpload(fileArray[i], i);
      }
      
      // Transition to reordering phase instead of auto-closing
      setUploadPhase('reordering');
    }
  };

  const handleFileUpload = async (file: File, fileIndex?: number) => {
    if (materialUploadType === 'pdf') {
      // Validate file type (accept PDFs and common image formats)
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
      ];
      if (!allowedTypes.includes(file.type)) {
        if (fileIndex !== undefined) {
          setUploadingFiles(prev => {
            const updated = [...prev];
            updated[fileIndex] = { ...updated[fileIndex], status: 'error', error: 'Invalid file type' };
            return updated;
          });
        }
        setError('Please select a valid PDF or image file (JPEG, PNG, GIF, WebP, BMP, SVG)');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        if (fileIndex !== undefined) {
          setUploadingFiles(prev => {
            const updated = [...prev];
            updated[fileIndex] = { ...updated[fileIndex], status: 'error', error: 'File too large (max 10MB)' };
            return updated;
          });
        }
        setError('File size must be less than 10MB');
        return;
      }

      // Determine type
      const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
      
      // Upload immediately
      await uploadFileImmediately(file, fileType, fileIndex);
      
    } else if (materialUploadType === 'video') {
      // Validate file type (accept common video formats)
      const allowedTypes = [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm'
      ];
      if (!allowedTypes.includes(file.type)) {
        if (fileIndex !== undefined) {
          setUploadingFiles(prev => {
            const updated = [...prev];
            updated[fileIndex] = { ...updated[fileIndex], status: 'error', error: 'Invalid file type' };
            return updated;
          });
        }
        setError('Please select a valid video file (MP4, MOV, AVI, MKV, WebM)');
        return;
      }
      
      // Validate file size (100MB max for videos)
      if (file.size > 100 * 1024 * 1024) {
        if (fileIndex !== undefined) {
          setUploadingFiles(prev => {
            const updated = [...prev];
            updated[fileIndex] = { ...updated[fileIndex], status: 'error', error: 'File too large (max 100MB)' };
            return updated;
          });
        }
        setError('Video file size must be less than 100MB');
        return;
      }

      // Upload immediately
      await uploadFileImmediately(file, 'video', fileIndex);
    }
  };

  const uploadFileImmediately = async (file: File, fileType: 'pdf' | 'image' | 'video', fileIndex?: number) => {
    setUploadingFile(true);
    
    // Update progress to show starting
    if (fileIndex !== undefined) {
      setUploadingFiles(prev => {
        const updated = [...prev];
        updated[fileIndex] = { ...updated[fileIndex], progress: 10, status: 'uploading' };
        return updated;
      });
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `unit-${unitForm.order_index}-${fileType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Simulate progress during upload
      if (fileIndex !== undefined) {
        setUploadingFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { ...updated[fileIndex], progress: 30, status: 'uploading' };
          return updated;
        });
      }

      const { error: uploadError } = await supabaseClient.storage
        .from('course-materials')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update progress after upload
      if (fileIndex !== undefined) {
        setUploadingFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { ...updated[fileIndex], progress: 70, status: 'uploading' };
          return updated;
        });
      }

      // Get public URL
      const { data: publicUrlData } = supabaseClient.storage
        .from('course-materials')
        .getPublicUrl(filePath);

      // Store uploaded URL in the uploadingFiles state for later use
      // DO NOT add to material arrays yet - wait for user to confirm order
      if (fileIndex !== undefined) {
        setUploadingFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { 
            ...updated[fileIndex], 
            progress: 100, 
            status: 'completed',
            uploadedUrl: publicUrlData.publicUrl
          };
          return updated;
        });
      }
      
      setError(null);
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      
      if (fileIndex !== undefined) {
        setUploadingFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { ...updated[fileIndex], status: 'error', error: uploadError.message };
          return updated;
        });
      }
      
      setError(`Failed to upload material: ${uploadError.message}`);
    }
    setUploadingFile(false);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Initialize upload tracking for all files with extended structure
      const fileArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const fileType = materialUploadType === 'pdf' ? 'pdf' : 'video'; // Determine base type

      setUploadingFiles(fileArray.map(f => {
        const actualType = f.type === 'application/pdf' ? 'pdf' : 
                          f.type.startsWith('image/') ? 'image' : 'video';
        const previewUrl = actualType === 'image' || actualType === 'video' ? URL.createObjectURL(f) : undefined;
        
        return {
          name: f.name,
          progress: 0,
          status: 'uploading' as const,
          file: f,
          previewUrl,
          type: actualType
        };
      }));
      
      setUploadPhase('uploading');
      
      // Handle multiple files - upload them sequentially
      for (let i = 0; i < fileArray.length; i++) {
        await handleFileUpload(fileArray[i], i);
      }
      
      // Transition to reordering phase instead of auto-closing
      setUploadPhase('reordering');
    }
  };


  const removeMaterial = (index: number) => {
    setMaterialUrls(prev => prev.filter((_, i) => i !== index));
    setMaterialNames(prev => prev.filter((_, i) => i !== index));
    setMaterialTypes(prev => prev.filter((_, i) => i !== index));
    setMaterialParts(prev => prev.filter((_, i) => i !== index));
  };

  const updateMaterialName = (index: number, newName: string) => {
    setMaterialNames(prev => {
      const updated = [...prev];
      updated[index] = newName;
      return updated;
    });
  };

  // Material parts management functions
  const addMaterialPart = () => {
    const partNumber = materialPartNames.length + 1;
    const newPartName = `Part ${partNumber}`;
    setMaterialPartNames(prev => [...prev, newPartName]);
    // Add new part as collapsed by default
    setCollapsedParts(prev => new Set([...prev, materialPartNames.length]));
  };

  const updateMaterialPartName = (partIndex: number, newName: string) => {
    setMaterialPartNames(prev => {
      const updated = [...prev];
      updated[partIndex] = newName;
      return updated;
    });
  };

  const removeMaterialPart = (partIndex: number) => {
    const partNumber = (partIndex + 1).toString();

    // Check if there are materials in this part
    const hasMaterials = materialParts.some(part => part === partNumber);

    if (hasMaterials) {
      // Show warning modal
      openRemovePartWarningModal(partIndex);
    } else {
      // No materials, remove part directly
      removePartOnly(partIndex);
    }
  };

  const removePartOnly = (partIndex: number) => {
    const partNumber = (partIndex + 1).toString();
    // Remove the part name
    setMaterialPartNames(prev => prev.filter((_, i) => i !== partIndex));
    // Update part indices for materials that come after the removed part
    setMaterialParts(prev => prev.map(part => {
      const currentPartNum = parseInt(part);
      if (currentPartNum > parseInt(partNumber)) {
        return (currentPartNum - 1).toString();
      }
      return part;
    }));

    // Also remove from collapsed set if it was collapsed
    setCollapsedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partIndex);
      // Update indices for parts after the removed one
      const updatedSet = new Set<number>();
      newSet.forEach(idx => {
        if (idx > partIndex) {
          updatedSet.add(idx - 1);
        } else if (idx < partIndex) {
          updatedSet.add(idx);
        }
      });
      return updatedSet;
    });
  };

  const removePartAndMaterials = (partIndex: number) => {
    const partNumber = (partIndex + 1).toString();
    // Remove the part name
    setMaterialPartNames(prev => prev.filter((_, i) => i !== partIndex));
    // Remove all materials assigned to this part
    const newMaterialUrls = [];
    const newMaterialNames = [];
    const newMaterialTypes = [];
    const newMaterialParts = [];

    for (let i = 0; i < materialUrls.length; i++) {
      if (materialParts[i] !== partNumber) {
        newMaterialUrls.push(materialUrls[i]);
        newMaterialNames.push(materialNames[i]);
        newMaterialTypes.push(materialTypes[i]);
        // Update part indices for materials that come after the removed part
        const currentPartNum = parseInt(materialParts[i]);
        if (currentPartNum > parseInt(partNumber)) {
          newMaterialParts.push((currentPartNum - 1).toString());
        } else {
          newMaterialParts.push(materialParts[i]);
        }
      }
    }

    setMaterialUrls(newMaterialUrls);
    setMaterialNames(newMaterialNames);
    setMaterialTypes(newMaterialTypes);
    setMaterialParts(newMaterialParts);

    // Also remove from collapsed set if it was collapsed
    setCollapsedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partIndex);
      // Update indices for parts after the removed one
      const updatedSet = new Set<number>();
      newSet.forEach(idx => {
        if (idx > partIndex) {
          updatedSet.add(idx - 1);
        } else if (idx < partIndex) {
          updatedSet.add(idx);
        }
      });
      return updatedSet;
    });
  };

  // Remove part warning modal handlers
  const handleRemovePartKeepFiles = () => {
    if (partToRemove !== null) {
      removePartOnly(partToRemove);
      closeRemovePartWarningModal();
    }
  };

  const handleRemovePartAndFiles = () => {
    if (partToRemove !== null) {
      removePartAndMaterials(partToRemove);
      closeRemovePartWarningModal();
    }
  };

  const handleCancelRemovePart = () => {
    closeRemovePartWarningModal();
  };

  const togglePartCollapse = (partIndex: number) => {
    setCollapsedParts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partIndex)) {
        newSet.delete(partIndex);
      } else {
        newSet.add(partIndex);
      }
      return newSet;
    });
  };

  const handlePreviewPart = (partIndex: number) => {
    const { groups } = getMaterialsGroupedByParts();
    const partKey = `part-${partIndex + 1}`;
    const materials = groups[partKey] || { urls: [], names: [], types: [], indices: [] };

    const previewData = materials.urls.map((url: string, localIndex: number) => ({
      name: materials.names[localIndex],
      type: materials.types[localIndex] as 'pdf' | 'image' | 'video' | 'question',
      url: url
    }));

    setPreviewMaterials(previewData);
    setPreviewPartIndex(partIndex);
  };

  const assignMaterialToPart = (materialIndex: number, partIndex: number) => {
    setMaterialParts(prev => {
      const updated = [...prev];
      updated[materialIndex] = (partIndex + 1).toString();
      return updated;
    });
  };

  const unassignMaterial = (materialIndex: number) => {
    setMaterialParts(prev => {
      const updated = [...prev];
      updated[materialIndex] = '';
      return updated;
    });
  };

  // Handler for adding material to a specific part
  const handleAddMaterialToPart = (partIndex: number) => {
    setShowPartMaterialDropdown(prev => prev === partIndex ? null : partIndex);
  };

  // Group materials by parts for display
  const getMaterialsGroupedByParts = () => {
    const groups: { [key: string]: { urls: string[], names: string[], types: string[], indices: number[] } } = {};
    const unassigned: { urls: string[], names: string[], types: string[], indices: number[] } = { urls: [], names: [], types: [], indices: [] };

    materialUrls.forEach((url, index) => {
      const partIndex = materialParts[index];
      if (partIndex && partIndex !== '0') {
        const partKey = `part-${partIndex}`;
        if (!groups[partKey]) {
          groups[partKey] = { urls: [], names: [], types: [], indices: [] };
        }
        groups[partKey].urls.push(url);
        groups[partKey].names.push(materialNames[index] || `Material ${index + 1}`);
        groups[partKey].types.push(materialTypes[index] || 'pdf');
        groups[partKey].indices.push(index);
      } else {
        unassigned.urls.push(url);
        unassigned.names.push(materialNames[index] || `Material ${index + 1}`);
        unassigned.types.push(materialTypes[index] || 'pdf');
        unassigned.indices.push(index);
      }
    });

    return { groups, unassigned };
  };

  const moveMaterial = useCallback((dragIndex: number, hoverIndex: number) => {
    setMaterialUrls(prev => {
      const updated = [...prev];
      const [draggedUrl] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedUrl);
      return updated;
    });
    setMaterialNames(prev => {
      const updated = [...prev];
      const [draggedName] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedName);
      return updated;
    });
    setMaterialTypes(prev => {
      const updated = [...prev];
      const [draggedType] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedType);
      return updated;
    });
    setMaterialParts(prev => {
      const updated = [...prev];
      const [draggedPart] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedPart);
      return updated;
    });
  }, []);

  const moveSelectedMaterialsToPart = useCallback((targetPartIndex: number) => {
    const selectedIndices = Array.from(selectedMaterials).sort((a, b) => b - a); // Sort in descending order
    const targetPart = targetPartIndex === -1 ? '' : (targetPartIndex + 1).toString();

    setMaterialParts(prev => {
      const updated = [...prev];
      selectedIndices.forEach(index => {
        updated[index] = targetPart;
      });
      return updated;
    });

    setSelectedMaterials(new Set());
    setBulkSelectionMode(false);
  }, [selectedMaterials]);

  const deleteSelectedMaterials = useCallback(() => {
    const selectedIndices = Array.from(selectedMaterials).sort((a, b) => b - a); // Sort in descending order to remove from end first
    
    setMaterialUrls(prev => prev.filter((_, index) => !selectedMaterials.has(index)));
    setMaterialNames(prev => prev.filter((_, index) => !selectedMaterials.has(index)));
    setMaterialTypes(prev => prev.filter((_, index) => !selectedMaterials.has(index)));
    setMaterialParts(prev => prev.filter((_, index) => !selectedMaterials.has(index)));
    
    setSelectedMaterials(new Set());
    setBulkSelectionMode(false);
    setShowDeleteSelectedModal(false);
  }, [selectedMaterials]);

  const moveSelectedToPosition = useCallback((position: 'top' | 'bottom') => {
    // Separate items into non-selected and selected (preserving relative order)
    const nonSelectedUrls: string[] = [];
    const nonSelectedNames: string[] = [];
    const nonSelectedTypes: string[] = [];
    const nonSelectedParts: string[] = [];
    
    const selectedUrls: string[] = [];
    const selectedNames: string[] = [];
    const selectedTypes: string[] = [];
    const selectedParts: string[] = [];
    
    materialUrls.forEach((url, index) => {
      if (selectedMaterials.has(index)) {
        selectedUrls.push(url);
        selectedNames.push(materialNames[index] || '');
        selectedTypes.push(materialTypes[index] || '');
        selectedParts.push(materialParts[index] || '');
      } else {
        nonSelectedUrls.push(url);
        nonSelectedNames.push(materialNames[index] || '');
        nonSelectedTypes.push(materialTypes[index] || '');
        nonSelectedParts.push(materialParts[index] || '');
      }
    });
    
    // Combine based on position
    if (position === 'top') {
      // Selected first, then non-selected
      setMaterialUrls([...selectedUrls, ...nonSelectedUrls]);
      setMaterialNames([...selectedNames, ...nonSelectedNames]);
      setMaterialTypes([...selectedTypes, ...nonSelectedTypes]);
      setMaterialParts([...selectedParts, ...nonSelectedParts]);
    } else {
      // Non-selected first, then selected at bottom
      setMaterialUrls([...nonSelectedUrls, ...selectedUrls]);
      setMaterialNames([...nonSelectedNames, ...selectedNames]);
      setMaterialTypes([...nonSelectedTypes, ...selectedTypes]);
      setMaterialParts([...nonSelectedParts, ...selectedParts]);
    }
    
    setSelectedMaterials(new Set());
    setBulkSelectionMode(false);
  }, [selectedMaterials, materialUrls, materialNames, materialTypes, materialParts]);

  // Review Question handlers
  // Questions are stored with type 'question' and the URL contains the question data as JSON
  const getQuestionFromUrl = (url: string): ReviewQuestion | null => {
    try {
      if (url.startsWith('data:application/json;base64,')) {
        const base64 = url.replace('data:application/json;base64,', '');
        const binary = atob(base64);
        // Decode UTF-8 bytes back to Unicode string
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const json = new TextDecoder().decode(bytes);
        return JSON.parse(json);
      }
      return null;
    } catch {
      return null;
    }
  };

  const createQuestionDataUrl = (question: ReviewQuestion): string => {
    const json = JSON.stringify(question);
    // Use TextEncoder to properly handle Unicode characters before base64 encoding
    const bytes = new TextEncoder().encode(json);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);
    return `data:application/json;base64,${base64}`;
  };

  const openQuestionModal = (index?: number) => {
    if (index !== undefined) {
      // Find the question data from the URL
      const questionData = getQuestionFromUrl(materialUrls[index]);
      if (questionData) {
        setEditingQuestionIndex(index);
        setQuestionForm({
          question_text: questionData.question_text,
          options: [...questionData.options],
          correct_answer_index: questionData.correct_answer_index,
          explanation: questionData.explanation || "",
        });
      }
    } else {
      setEditingQuestionIndex(null);
      setQuestionForm({
        question_text: "",
        options: ["", "", "", ""],
        correct_answer_index: 0,
        explanation: "",
      });
    }
    setShowQuestionModal(true);
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    setEditingQuestionIndex(null);
    setTargetPartIndex(null);
    setQuestionForm({
      question_text: "",
      options: ["", "", "", ""],
      correct_answer_index: 0,
      explanation: "",
    });
  };

  const handleQuestionSubmit = () => {
    // Validate question
    if (!questionForm.question_text.trim()) {
      setError("Question text is required");
      return;
    }
    
    // Validate that all options are filled
    const filledOptions = questionForm.options.filter(opt => opt.trim());
    if (filledOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    const newQuestion: ReviewQuestion = {
      question_text: questionForm.question_text.trim(),
      options: questionForm.options.filter(opt => opt.trim()),
      correct_answer_index: questionForm.correct_answer_index,
      explanation: questionForm.explanation.trim() || null,
    };

    // Create data URL for the question
    const questionUrl = createQuestionDataUrl(newQuestion);
    const questionName = `Q${editingQuestionIndex !== null ? editingQuestionIndex + 1 : materialTypes.filter(t => t === 'question').length + 1}: ${newQuestion.question_text.substring(0, 30)}${newQuestion.question_text.length > 30 ? '...' : ''}`;

    if (editingQuestionIndex !== null) {
      // Update existing question
      setMaterialUrls(prev => {
        const updated = [...prev];
        updated[editingQuestionIndex] = questionUrl;
        return updated;
      });
      setMaterialNames(prev => {
        const updated = [...prev];
        updated[editingQuestionIndex] = questionName;
        return updated;
      });
    } else {
      // Add new question at the end
      setMaterialUrls(prev => [...prev, questionUrl]);
      setMaterialNames(prev => [...prev, questionName]);
      setMaterialTypes(prev => [...prev, 'question']);
      
      // Assign to target part if specified
      if (targetPartIndex !== null) {
        setMaterialParts(prev => [...prev, (targetPartIndex + 1).toString()]);
      } else {
        setMaterialParts(prev => [...prev, '']);
      }
    }

    closeQuestionModal();
    setError(null);
  };

  const deleteReviewQuestion = (index: number) => {
    removeMaterial(index);
  };

  const moveSection = useCallback(async (dragIndex: number, hoverIndex: number) => {
    // Store original state for potential rollback
    const originalSections = [...sections];

    // Calculate the reordered sections
    const updatedSections = [...sections];
    const [draggedSection] = updatedSections.splice(dragIndex, 1);
    updatedSections.splice(hoverIndex, 0, draggedSection);
    const reorderedSections = updatedSections.map((section, index) => ({
      ...section,
      display_order: index + 1,
    }));

    // Optimistically update UI
    setSections(reorderedSections);

    try {
      // Update database
      const updatePromises = reorderedSections.map(section =>
        supabaseClient
          .from("course_sections")
          .update({ display_order: section.display_order, updated_at: new Date().toISOString() })
          .eq("id", section.id)
      );

      await Promise.all(updatePromises);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error("Error updating section order:", err);
      setError("Failed to update section order. Please try again.");
      // Revert UI to original state
      setSections(originalSections);
    }
  }, [sections]);

  const moveUnit = useCallback(async (dragIndex: number, hoverIndex: number) => {
    setUnits(prev => {
      const updated = [...prev];
      const [draggedUnit] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedUnit);
      
      // Update order_index and unit_number for all units (unit_number should match display order)
      const reordered = updated.map((unit, index) => ({
        ...unit,
        order_index: index + 1,
        unit_number: index + 1,
      }));

      // Save to database
      Promise.all(
        reordered.map(unit =>
          supabaseClient
            .from("course_units")
            .update({ order_index: unit.order_index, unit_number: unit.unit_number, updated_at: new Date().toISOString() })
            .eq("id", unit.id)
        )
      ).catch(err => {
        console.error("Error updating unit order:", err);
        setError("Failed to update unit order");
      });
      
      return reordered;
    });
  }, []);

  const moveTest = useCallback(async (dragIndex: number, hoverIndex: number) => {
    setTests(prev => {
      const updated = [...prev];
      const [draggedTest] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedTest);
      
      // Update order_index for all tests
      const reordered = updated.map((test, index) => ({
        ...test,
        order_index: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(test =>
          supabaseClient
            .from("course_tests")
            .update({ order_index: test.order_index, updated_at: new Date().toISOString() })
            .eq("id", test.id)
        )
      ).catch(err => {
        console.error("Error updating test order:", err);
        setError("Failed to update test order");
      });
      
      return reordered;
    });
  }, []);

  const togglePrerequisiteUnit = (unitNumber: number) => {
    setUnitForm(prev => ({
      ...prev,
      prerequisite_units: prev.prerequisite_units.includes(unitNumber)
        ? prev.prerequisite_units.filter(u => u !== unitNumber)
        : [...prev.prerequisite_units, unitNumber].sort((a, b) => a - b)
    }));
  };

  const togglePrerequisiteTest = (testId: string) => {
    setUnitForm(prev => ({
      ...prev,
      prerequisite_tests: prev.prerequisite_tests.includes(testId)
        ? prev.prerequisite_tests.filter(t => t !== testId)
        : [...prev.prerequisite_tests, testId]
    }));
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      // Start with existing materials
      let finalUrls: string[] = [...materialUrls];
      let finalNames: string[] = [...materialNames];
      let finalTypes: string[] = [...materialTypes];

      // Ensure all arrays have the same length
      const maxLength = Math.max(finalUrls.length, finalNames.length, finalTypes.length, materialParts.length);
      while (finalUrls.length < maxLength) finalUrls.push('');
      while (finalNames.length < maxLength) finalNames.push(`Material ${finalNames.length + 1}`);
      while (finalTypes.length < maxLength) finalTypes.push('pdf');

      // Ensure materialParts matches the length
      let finalParts = [...materialParts];
      while (finalParts.length < maxLength) finalParts.push('');

      const payload: any = {
        title: unitForm.title,
        description: unitForm.description,
        content: unitForm.content,
        order_index: editingUnit ? editingUnit.order_index : units.length + 1,
        is_mandatory: unitForm.is_mandatory,
        section_id: unitForm.section_id || null,
        material_urls: finalUrls.length > 0 ? finalUrls : [],
        material_names: finalNames.length > 0 ? finalNames : [],
        material_types: finalTypes.length > 0 ? finalTypes : [],
        material_part_names: materialPartNames.length > 0 ? materialPartNames : [],
        material_parts: finalParts.length > 0 ? finalParts : [],
        prerequisite_units: unitForm.prerequisite_units,
        prerequisite_tests: unitForm.prerequisite_tests,
        updated_at: new Date().toISOString(),
      };

      if (editingUnit) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_units")
          .update(payload)
          .eq("id", editingUnit.id);

        if (updateError) throw updateError;
        
        // Reorder other units if necessary
        await reorderUnitsAfterChange();
      } else {
        // Create
        payload.course_id = courseId;
        const { error: insertError } = await supabaseClient
          .from("course_units")
          .insert(payload);

        if (insertError) throw insertError;
        
        // Reorder other units if necessary
        await reorderUnitsAfterChange();
      }

      // After successful save, directly close form without unsaved changes check
      performCloseUnitForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving unit:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this unit?\n\nThis will move the unit and any associated files to the recycle bin.\n\nItems in the recycle bin will be permanently deleted after 30 days.\n\nYou can restore items from the recycle bin if needed.")) return;

    try {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setError("User not authenticated");
        return;
      }
      
      const now = new Date().toISOString();

      const { error: deleteError } = await supabaseClient
        .from("course_units")
        .update({ deleted_at: now, deleted_by: userId })
        .eq("id", unitId);

      if (deleteError) throw deleteError;

      // Move storage files to deleted folder
      const { moveStorageFilesToDeleted } = await import("../../utility/storageHelpers");
      await moveStorageFilesToDeleted(unitId, "unit", userId);

      await loadData();
    } catch (err: any) {
      console.error("Error deleting unit:", err);
      setError(err.message);
    }
  };

  const reorderUnitsAfterChange = async () => {
    if (!courseId) return;
    
    // Fetch all units again to get the latest data
    const { data: allUnits, error } = await supabaseClient
      .from("course_units")
      .select("id, unit_number")
      .eq("course_id", courseId);
    
    if (error || !allUnits) return;
    
    // Sort by unit_number and assign correct order_index
    const sortedUnits = [...allUnits].sort((a, b) => a.unit_number - b.unit_number);
    
    // Update all units with correct order_index
    await Promise.all(
      sortedUnits.map((unit, index) =>
        supabaseClient
          .from("course_units")
          .update({ order_index: index + 1, updated_at: new Date().toISOString() })
          .eq("id", unit.id)
      )
    );
  };

  const handleDuplicateUnit = async (unit: CourseUnit) => {
    if (!confirm(`Are you sure you want to duplicate "${unit.title}"?`)) return;

    try {
      setSubmitting(true);
      setError(null);

      // Create a copy of the unit
      const nextOrderIndex = Math.max(...units.map(u => u.order_index), 0) + 1;

      const duplicatedUnit = {
        course_id: unit.course_id,
        title: `${unit.title} (Copy)`,
        description: unit.description,
        content: unit.content,
        is_mandatory: unit.is_mandatory,
        order_index: nextOrderIndex,
        section_id: unit.section_id,
        material_urls: unit.material_urls || [],
        material_names: unit.material_names || [],
        material_types: unit.material_types || [],
        material_part_names: unit.material_part_names || [],
        material_parts: unit.material_parts || [],
        prerequisite_units: unit.prerequisite_units,
        prerequisite_tests: unit.prerequisite_tests,
      };

      const { error: insertError } = await supabaseClient
        .from("course_units")
        .insert(duplicatedUnit);

      if (insertError) throw insertError;

      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error duplicating unit:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleMoveUnit = (unit: CourseUnit) => {
    setMovingItem({ type: 'unit', item: unit });
    setTargetCourseId("");
    setCourseSearchQuery("");
    setShowMoveModal(true);
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return "Unassigned";
    const section = sections.find(s => s.id === sectionId);
    return section?.name || "Unknown";
  };

  const getTestName = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    return test?.test_name || "Unknown Test";
  };

  const getUnitName = (unitNumber: number) => {
    const unit = units.find(u => u.unit_number === unitNumber);
    return unit?.title || "Unknown Unit";
  };

  // Test handlers
  const openTestForm = (test?: CourseTest) => {
    if (test) {
      setEditingTest(test);
      setTestForm({
        test_name: test.test_name,
        test_description: test.test_description || "",
        test_type: test.test_type,
        passing_score: test.passing_score,
        required_for_progression: test.required_for_progression,
        required_units: test.required_units || [],
        order_index: test.order_index,
        is_active: test.is_active,
        section_id: test.section_id || "",
        needs_proctor: test.needs_proctor || false,
        duration: test.duration || 60,
        price_of_schedule: test.price_of_schedule ?? null,
      });
    } else {
      setEditingTest(null);
      setTestForm({
        test_name: "",
        test_description: "",
        test_type: "multiple_choice",
        passing_score: 70,
        required_for_progression: true,
        required_units: [],
        order_index: tests.length + 1,
        is_active: true,
        section_id: "",
        needs_proctor: false,
        duration: 60,
        price_of_schedule: null,
      });
    }
    setShowTestForm(true);
  };

  const closeTestForm = () => {
    setShowTestForm(false);
    setEditingTest(null);
    setTestForm({
      test_name: "",
      test_description: "",
      test_type: "multiple_choice",
      passing_score: 70,
      required_for_progression: true,
      required_units: [],
      order_index: 0,
      is_active: true,
      section_id: "",
      needs_proctor: false,
      duration: 60,
      price_of_schedule: null,
    });
    setError(null);
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    // Validate that price_of_schedule is provided when needs_proctor is checked
    if (testForm.needs_proctor && (testForm.price_of_schedule === null || testForm.price_of_schedule === undefined)) {
      setError("Price of Schedule (USD) is required when Needs proctor is checked.");
      setSubmitting(false);
      return;
    }

    // Validate price range (stored in cents: 0 to 50000 cents = $0 to $500)
    if (testForm.needs_proctor && testForm.price_of_schedule !== null && (testForm.price_of_schedule < 0 || testForm.price_of_schedule > 50000)) {
      setError("Price of Schedule must be between $0.00 and $500.00 USD.");
      setSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        test_name: testForm.test_name,
        test_description: testForm.test_description,
        test_type: testForm.test_type,
        passing_score: testForm.passing_score,
        required_for_progression: testForm.required_for_progression,
        required_units: testForm.required_units,
        order_index: testForm.order_index,
        is_active: testForm.is_active,
        section_id: testForm.section_id || null,
        needs_proctor: testForm.needs_proctor,
        duration: testForm.duration,
        price_of_schedule: testForm.needs_proctor ? (testForm.price_of_schedule ?? null) : null,
        updated_at: new Date().toISOString(),
      };

      if (editingTest) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_tests")
          .update(payload)
          .eq("id", editingTest.id);

        if (updateError) throw updateError;
      } else {
        // Create
        payload.course_id = courseId;
        const { error: insertError } = await supabaseClient
          .from("course_tests")
          .insert(payload);

        if (insertError) throw insertError;
      }

      closeTestForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving test:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Are you sure you want to delete this test?\n\nThis will move the test and ALL its questions to the recycle bin.\n\nItems in the recycle bin will be permanently deleted after 30 days.\n\nYou can restore items from the recycle bin if needed.")) return;

    try {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        setError("User not authenticated");
        return;
      }
      
      const now = new Date().toISOString();

      // Soft delete the test
      const { error: deleteError } = await supabaseClient
        .from("course_tests")
        .update({ deleted_at: now, deleted_by: userId })
        .eq("id", testId);

      if (deleteError) throw deleteError;

      // Cascade soft delete to test questions
      await supabaseClient
        .from("test_questions")
        .update({ deleted_at: now, deleted_by: userId })
        .eq("test_id", testId)
        .is("deleted_at", null);

      // Move storage files to deleted folder
      const { moveStorageFilesToDeleted } = await import("../../utility/storageHelpers");
      await moveStorageFilesToDeleted(testId, "test", userId);

      await loadData();
    } catch (err: any) {
      console.error("Error deleting test:", err);
      setError(err.message);
    }
  };

  const handleDuplicateTest = async (test: CourseTest) => {
    if (!confirm(`Are you sure you want to duplicate "${test.test_name}"? This will copy the test including all questions, answers, criteria, and graphs.`)) return;

    try {
      setSubmitting(true);
      setError(null);

      // Create a copy of the test
      const nextOrderIndex = Math.max(...tests.map(t => t.order_index), 0) + 1;
      
      const duplicatedTest = {
        course_id: test.course_id,
        test_name: `${test.test_name} (Copy)`,
        test_description: test.test_description,
        test_type: test.test_type,
        passing_score: test.passing_score,
        required_for_progression: test.required_for_progression,
        required_units: test.required_units,
        order_index: nextOrderIndex,
        questions: test.questions, // Legacy JSON questions
        is_active: false, // Start as inactive
        section_id: test.section_id,
        needs_proctor: test.needs_proctor,
        duration: test.duration || 60,
        price_of_schedule: test.price_of_schedule ?? null,
      };

      const { data: newTest, error: insertError } = await supabaseClient
        .from("course_tests")
        .insert(duplicatedTest)
        .select()
        .single();

      if (insertError) throw insertError;

      // Duplicate test_questions if they exist (for multiple_choice and practical tests)
      const { data: originalQuestions, error: questionsError } = await supabaseClient
        .from("test_questions")
        .select("*")
        .eq("test_id", test.id)
        .order("question_number", { ascending: true });

      if (questionsError) throw questionsError;

      if (originalQuestions && originalQuestions.length > 0) {
        const duplicatedQuestions = originalQuestions.map(q => ({
          test_id: newTest.id,
          question_number: q.question_number,
          question_area: q.question_area,
          question_text: q.question_text,
          options: q.options,
          correct_answer_index: q.correct_answer_index,
          explanation: q.explanation,
          image_urls: q.image_urls,
          problem_sets: q.problem_sets,
        }));

        const { error: insertQuestionsError } = await supabaseClient
          .from("test_questions")
          .insert(duplicatedQuestions);

        if (insertQuestionsError) throw insertQuestionsError;

        // Update question_source to 'database' for the new test
        await supabaseClient
          .from("course_tests")
          .update({ question_source: 'database' })
          .eq("id", newTest.id);
      }

      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error duplicating test:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleMoveTest = (test: CourseTest) => {
    setMovingItem({ type: 'test', item: test });
    setTargetCourseId("");
    setCourseSearchQuery("");
    setShowMoveModal(true);
  };

  const toggleUnitSelection = (unitNumber: number) => {
    setTestForm(prev => ({
      ...prev,
      required_units: prev.required_units.includes(unitNumber)
        ? prev.required_units.filter(u => u !== unitNumber)
        : [...prev.required_units, unitNumber].sort((a, b) => a - b)
    }));
  };

  const handleConfirmMove = async () => {
    if (!movingItem || !targetCourseId) {
      setError("Please select a target course");
      return;
    }

    if (targetCourseId === courseId) {
      setError("Target course must be different from the current course");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (movingItem.type === 'unit') {
        const unit = movingItem.item as CourseUnit;
        
        // Get the max order_index in the target course for units
        const { data: targetUnits, error: fetchError } = await supabaseClient
          .from("course_units")
          .select("order_index, unit_number")
          .eq("course_id", targetCourseId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const nextOrderIndex = targetUnits && targetUnits.length > 0 ? targetUnits[0].order_index + 1 : 1;
        const nextUnitNumber = targetUnits && targetUnits.length > 0 ? targetUnits[0].unit_number + 1 : 1;
        
        // Update the unit's course_id with new order_index
        const { error: updateError } = await supabaseClient
          .from("course_units")
          .update({ 
            course_id: targetCourseId,
            section_id: null, // Clear section since it belongs to the old course
            order_index: nextOrderIndex,
            unit_number: nextUnitNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", unit.id);

        if (updateError) throw updateError;
      } else if (movingItem.type === 'test') {
        const test = movingItem.item as CourseTest;
        
        // Get the max order_index in the target course for tests
        const { data: targetTests, error: fetchError } = await supabaseClient
          .from("course_tests")
          .select("order_index")
          .eq("course_id", targetCourseId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const nextOrderIndex = targetTests && targetTests.length > 0 ? targetTests[0].order_index + 1 : 1;
        
        // Update the test's course_id with new order_index
        const { error: updateError } = await supabaseClient
          .from("course_tests")
          .update({ 
            course_id: targetCourseId,
            section_id: null, // Clear section since it belongs to the old course
            order_index: nextOrderIndex,
            updated_at: new Date().toISOString(),
          })
          .eq("id", test.id);

        if (updateError) throw updateError;
      }

      setShowMoveModal(false);
      setMovingItem(null);
      setTargetCourseId("");
      setCourseSearchQuery("");
      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error moving item:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const closeMoveModal = () => {
    setShowMoveModal(false);
    setMovingItem(null);
    setTargetCourseId("");
    setCourseSearchQuery("");
    setError(null);
  };

  const filteredCourses = allCourses.filter(c => 
    c.id !== courseId && 
    c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="page-card">
        <p>Loading...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page-card">
        <div className="alert error">Course not found or not a Buzz course.</div>
        <button className="ghost-btn" onClick={() => navigate("/admin/academy-courses")}>
          Back to Courses
        </button>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <button 
            className="ghost-btn" 
            onClick={() => navigate("/admin/academy-courses")}
            style={{ marginBottom: 12 }}
          >
            ← Back to Courses
          </button>
          <h1>Course Manager</h1>
          <div style={{ marginTop: 8, marginBottom: 24 }}>
            <p style={{ color: "#9ca3b5", margin: 0, fontSize: "16px", fontWeight: 500 }}>
              {course.title} ({course.id})
            </p>
            <div style={{ marginTop: 4, display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {course.provider && (
                <span style={{
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 500
                }}>
                  Provider: {course.provider}
                </span>
              )}
              {course.region && (
                <span style={{
                  backgroundColor: "#dbeafe",
                  color: "#1e40af",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 500
                }}>
                  Region: {course.region}
                </span>
              )}
              {course.category && (
                <span style={{
                  backgroundColor: "#dcfce7",
                  color: "#166534",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 500
                }}>
                  Category: {course.category}
                </span>
              )}
              <span style={{
                backgroundColor: course.active ? "#dcfce7" : "#fee2e2",
                color: course.active ? "#166534" : "#dc2626",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: 500
              }}>
                {course.active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && !showSectionForm && !showUnitForm && !showTestForm && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Sections Section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Sections</h2>
          <button className="primary-btn" onClick={() => openSectionForm()}>
            + New Section
          </button>
        </div>

        {sections.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No sections yet. Sections help organize units into folders.</p>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Units Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, index) => (
                  <DraggableSectionItem
                    key={section.id}
                    section={section}
                    index={index}
                    unitsCount={units.filter(u => u.section_id === section.id).length}
                    onEdit={() => openSectionForm(section)}
                    onDelete={() => handleDeleteSection(section.id)}
                    onMove={moveSection}
                  />
                ))}
              </tbody>
            </table>
          </DndProvider>
        )}
      </div>

      {/* Units Section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Units</h2>
          <button className="primary-btn" onClick={() => openUnitForm()}>
            + New Unit
          </button>
        </div>

        {units.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No units yet.</p>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Section</th>
                  <th>Prerequisites</th>
                  <th>Mandatory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, index) => {
                  const prereqs = [];
                  const hasPrereqUnits = unit.prerequisite_units && unit.prerequisite_units.length > 0;
                  const hasPrereqTests = unit.prerequisite_tests && unit.prerequisite_tests.length > 0;
                  
                  if (hasPrereqUnits) {
                    const unitNames = unit.prerequisite_units.map(id => getUnitName(id)).join(", ");
                    // Only add "Units:" prefix if there are also tests
                    prereqs.push(hasPrereqTests ? `Units: ${unitNames}` : unitNames);
                  }
                  if (hasPrereqTests) {
                    const testNames = unit.prerequisite_tests.map(id => getTestName(id)).join(", ");
                    // Only add "Tests:" prefix if there are also units
                    prereqs.push(hasPrereqUnits ? `Tests: ${testNames}` : testNames);
                  }
                  const prerequisitesText = prereqs.length > 0 ? prereqs.join(" | ") : "None";
                  
                  // Check if this is the first unit in a new section
                  const isFirstInSection = index === 0 || units[index - 1].section_id !== unit.section_id;
                  
                  // Assign alternating colors to different sections
                  const sectionIndex = sections.findIndex(s => s.id === unit.section_id);
                  const sectionColor = sectionIndex % 2 === 0 
                    ? 'rgba(107, 140, 174, 0.05)' 
                    : 'rgba(107, 140, 174, 0.02)';
                  
                  return (
                    <DraggableUnitItem
                      key={unit.id}
                      unit={unit}
                      index={index}
                      sectionName={getSectionName(unit.section_id)}
                      prerequisitesText={prerequisitesText}
                      onEdit={() => openUnitForm(unit)}
                      onDelete={() => handleDeleteUnit(unit.id)}
                      onMove={moveUnit}
                      isFirstInSection={isFirstInSection}
                      sectionColor={sectionColor}
                    />
                  );
                })}
              </tbody>
            </table>
          </DndProvider>
        )}
      </div>

      {/* Tests Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Tests</h2>
          <button className="primary-btn" onClick={() => openTestForm()}>
            + New Test
          </button>
        </div>

        {tests.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No tests yet.</p>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Test Name</th>
                  <th>Type</th>
                  <th>Passing Score</th>
                  <th>Section</th>
                  <th>Required Units</th>
                  <th>Required</th>
                  <th>Proctor</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test, index) => (
                  <DraggableTestItem
                    key={test.id}
                    test={test}
                    index={index}
                    sectionName={getSectionName(test.section_id)}
                    onEdit={() => openTestForm(test)}
                    onDelete={() => handleDeleteTest(test.id)}
                    onMove={moveTest}
                    onManageQuestions={(test.test_type === "multiple_choice" || test.test_type === "practical") ? () => {
                      setManagingTest(test);
                      setShowQuestionsManager(true);
                    } : undefined}
                  />
                ))}
              </tbody>
            </table>
          </DndProvider>
        )}
      </div>

      {/* Section Form Modal */}
      {showSectionForm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingSection ? "Edit Section" : "Create Section"}
              </h3>
              <button className="ghost-btn" onClick={closeSectionForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSectionSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Name *</label>
              <input
                name="name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                className="text-input"
                placeholder="Section name"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingSection ? "Update Section" : "Create Section"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeSectionForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Form Modal */}
      {showUnitForm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingUnit ? "Edit Unit" : "Create Unit"}
              </h3>
              <button className="ghost-btn" onClick={closeUnitForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleUnitSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Unit Title *</label>
              <input
                name="title"
                value={unitForm.title}
                onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                className="text-input"
                placeholder="Unit title"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={unitForm.description}
                onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              {/* Unified Course Materials Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Course Materials</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {bulkSelectionMode && selectedMaterials.size > 0 && (
                    <span style={{ fontSize: '14px', color: '#6b8cae', fontWeight: 500 }}>
                      {selectedMaterials.size} selected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSelectionMode(!bulkSelectionMode);
                      setSelectedMaterials(new Set());
                    }}
                    style={{
                      backgroundColor: bulkSelectionMode ? 'rgba(220, 38, 38, 0.9)' : 'rgba(107, 140, 174, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{bulkSelectionMode ? '✗' : '☑'}</span>
                    {bulkSelectionMode ? 'Exit Select' : 'Select Multiple'}
                  </button>
                  <div style={{ position: 'relative' }} className="material-dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowMaterialTypeDropdown(!showMaterialTypeDropdown)}
                    style={{
                      backgroundColor: 'rgba(107, 140, 174, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>+</span>
                    Add Material
                  </button>
                  
                  {showMaterialTypeDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(107, 140, 174, 0.3)',
                        borderRadius: '8px',
                        minWidth: '200px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                        zIndex: 1001,
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openMaterialUploadModal('pdf')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 140, 174, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <span>PDF or Image</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => openMaterialUploadModal('video')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 140, 174, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ fontSize: '20px' }}>🎬</span>
                        <span>Video</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMaterialUploadModal('question');
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.2s',
                          borderTop: '1px solid rgba(107, 140, 174, 0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 140, 174, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ fontSize: '20px' }}>✏️</span>
                        <span>Review Question</span>
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Bulk Actions Toolbar */}
              {bulkSelectionMode && selectedMaterials.size > 0 && (
                <div style={{
                  backgroundColor: 'rgba(107, 140, 174, 0.1)',
                  border: '1px solid rgba(107, 140, 174, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', color: '#6b8cae', fontWeight: 500 }}>
                    {selectedMaterials.size} material{selectedMaterials.size !== 1 ? 's' : ''} selected
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: '1px solid rgba(107, 140, 174, 0.3)',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        fontSize: '14px'
                      }}
                      onChange={(e) => {
                        if (e.target.value) {
                          moveSelectedMaterialsToPart(parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Move to part...</option>
                      {materialPartNames.map((partName, index) => (
                        <option key={index} value={index}>
                          {partName || `Part ${index + 1}`}
                        </option>
                      ))}
                      <option value="-1">Unassigned</option>
                    </select>
                    <select
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: '1px solid rgba(107, 140, 174, 0.3)',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        fontSize: '14px'
                      }}
                      onChange={(e) => {
                        if (e.target.value) {
                          moveSelectedToPosition(e.target.value as 'top' | 'bottom');
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Move to...</option>
                      <option value="top">Move to Top</option>
                      <option value="bottom">Move to Bottom</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowDeleteSelectedModal(true)}
                      style={{
                        backgroundColor: 'rgba(220, 38, 38, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      Delete Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMaterials(new Set())}
                      style={{
                        backgroundColor: 'rgba(156, 163, 175, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                {/* Material Parts Management */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Material Parts</h4>
                    <button
                      type="button"
                      onClick={addMaterialPart}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#6b8cae',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      + Add Part
                    </button>
                  </div>

                </div>

                {/* Display materials grouped by parts */}
                {materialUrls.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <DndProvider backend={HTML5Backend}>
                      {(() => {
                        const { groups, unassigned } = getMaterialsGroupedByParts();

                        return (
                          <>
                            {/* Render all created parts (including empty ones) */}
                            {materialPartNames.map((partName, partIndex) => {
                              const partKey = `part-${partIndex + 1}`;
                              const materials = groups[partKey] || { urls: [], names: [], types: [], indices: [] };

                              return (
                                <DroppablePartContainer
                                  key={partKey}
                                  partIndex={partIndex}
                                  partName={partName}
                                  onMaterialDropped={assignMaterialToPart}
                                  materialCount={materials.urls.length}
                                  onPartNameChange={updateMaterialPartName}
                                  onRemovePart={removeMaterialPart}
                                  onMovePart={openMovePartModal}
                                  isCollapsed={collapsedParts.has(partIndex)}
                                  onToggleCollapse={togglePartCollapse}
                                  onPreviewPart={handlePreviewPart}
                                  onAddMaterial={handleAddMaterialToPart}
                                  showDropdown={showPartMaterialDropdown === partIndex}
                                  showPartDropdown={showPartDropdown === partIndex}
                                  onTogglePartDropdown={setShowPartDropdown}
                                  onOpenUploadModal={openMaterialUploadModal}
                                >
                                  {materials.urls.map((url, localIndex) => {
                                    const globalIndex = materials.indices[localIndex];
                                    const type = materials.types[localIndex];
                                    const name = materials.names[localIndex];

                                    if (type === 'question') {
                                      const questionData = getQuestionFromUrl(url);
                                      if (questionData) {
                                        return (
                                          <DraggableQuestionItem
                                            key={`material-${globalIndex}`}
                                            question={questionData}
                                            index={globalIndex}
                                            name={name}
                                            partAssignment={partKey}
                                            materialPartNames={materialPartNames}
                                            onAssignToPart={assignMaterialToPart}
                                            onNameChange={(materialIndex, newName) => {
                                              setMaterialNames(prev => {
                                                const updated = [...prev];
                                                updated[materialIndex] = newName;
                                                return updated;
                                              });
                                            }}
                                            onEdit={() => openQuestionModal(globalIndex)}
                                            onDelete={() => deleteReviewQuestion(globalIndex)}
                                            onMove={moveMaterial}
                                            bulkSelectionMode={bulkSelectionMode}
                                            selectedMaterials={selectedMaterials}
                                            onToggleSelection={(index) => {
                                              setSelectedMaterials(prev => {
                                                const newSet = new Set(prev);
                                                if (newSet.has(index)) {
                                                  newSet.delete(index);
                                                } else {
                                                  newSet.add(index);
                                                }
                                                return newSet;
                                              });
                                            }}
                                          />
                                        );
                                      }
                                      return null;
                                    } else if (type === 'video') {
                                      return (
                                        <DraggableVideoItem
                                          key={`material-${globalIndex}`}
                                          index={globalIndex}
                                          url={url}
                                          name={name}
                                          partAssignment={partKey}
                                          materialPartNames={materialPartNames}
                                          onAssignToPart={assignMaterialToPart}
                                          onNameChange={updateMaterialName}
                                          onRemove={removeMaterial}
                                          onMove={moveMaterial}
                                          bulkSelectionMode={bulkSelectionMode}
                                          selectedMaterials={selectedMaterials}
                                          onToggleSelection={(index) => {
                                            setSelectedMaterials(prev => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(index)) {
                                                newSet.delete(index);
                                              } else {
                                                newSet.add(index);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        />
                                      );
                                    } else {
                                      // PDF or image
                                      return (
                                        <DraggablePDFItem
                                          key={`material-${globalIndex}`}
                                          index={globalIndex}
                                          url={url}
                                          name={name}
                                          type={type}
                                          partAssignment={partKey}
                                          materialPartNames={materialPartNames}
                                          onAssignToPart={assignMaterialToPart}
                                          onNameChange={updateMaterialName}
                                          onRemove={removeMaterial}
                                          onMove={moveMaterial}
                                          bulkSelectionMode={bulkSelectionMode}
                                          selectedMaterials={selectedMaterials}
                                          onToggleSelection={(index) => {
                                            setSelectedMaterials(prev => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(index)) {
                                                newSet.delete(index);
                                              } else {
                                                newSet.add(index);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        />
                                      );
                                    }
                                  })}
                                </DroppablePartContainer>
                              );
                            })}

                            {/* Render unassigned materials */}
                            {unassigned.urls.length > 0 && (
                              <DroppableUnassignedContainer
                                onMaterialDropped={unassignMaterial}
                                materialCount={unassigned.urls.length}
                              >
                                {unassigned.urls.map((url, localIndex) => {
                                  const globalIndex = unassigned.indices[localIndex];
                                  const type = unassigned.types[localIndex];
                                  const name = unassigned.names[localIndex];

                                  if (type === 'question') {
                                    const questionData = getQuestionFromUrl(url);
                                    if (questionData) {
                                      return (
                                        <DraggableQuestionItem
                                          key={`material-${globalIndex}`}
                                          question={questionData}
                                          index={globalIndex}
                                          name={name}
                                          partAssignment="unassigned"
                                          materialPartNames={materialPartNames}
                                          onAssignToPart={assignMaterialToPart}
                                          onNameChange={(materialIndex, newName) => {
                                            setMaterialNames(prev => {
                                              const updated = [...prev];
                                              updated[materialIndex] = newName;
                                              return updated;
                                            });
                                          }}
                                          onEdit={() => openQuestionModal(globalIndex)}
                                          onDelete={() => deleteReviewQuestion(globalIndex)}
                                          onMove={moveMaterial}
                                          bulkSelectionMode={bulkSelectionMode}
                                          selectedMaterials={selectedMaterials}
                                          onToggleSelection={(index) => {
                                            setSelectedMaterials(prev => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(index)) {
                                                newSet.delete(index);
                                              } else {
                                                newSet.add(index);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        />
                                      );
                                    }
                                    return null;
                                  } else if (type === 'video') {
                                    return (
                                      <DraggableVideoItem
                                        key={`material-${globalIndex}`}
                                        index={globalIndex}
                                        url={url}
                                        name={name}
                                        partAssignment="unassigned"
                                        materialPartNames={materialPartNames}
                                        onAssignToPart={assignMaterialToPart}
                                        onNameChange={updateMaterialName}
                                        onRemove={removeMaterial}
                                        onMove={moveMaterial}
                                        bulkSelectionMode={bulkSelectionMode}
                                        selectedMaterials={selectedMaterials}
                                        onToggleSelection={(index) => {
                                          setSelectedMaterials(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(index)) {
                                              newSet.delete(index);
                                            } else {
                                              newSet.add(index);
                                            }
                                            return newSet;
                                          });
                                        }}
                                      />
                                    );
                                  } else {
                                    // PDF or image
                                    return (
                                      <DraggablePDFItem
                                        key={`material-${globalIndex}`}
                                        index={globalIndex}
                                        url={url}
                                        name={name}
                                        type={type}
                                        partAssignment="unassigned"
                                        materialPartNames={materialPartNames}
                                        onAssignToPart={assignMaterialToPart}
                                        onNameChange={updateMaterialName}
                                        onRemove={removeMaterial}
                                        onMove={moveMaterial}
                                        bulkSelectionMode={bulkSelectionMode}
                                        selectedMaterials={selectedMaterials}
                                        onToggleSelection={(index) => {
                                          setSelectedMaterials(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(index)) {
                                              newSet.delete(index);
                                            } else {
                                              newSet.add(index);
                                            }
                                            return newSet;
                                          });
                                        }}
                                      />
                                    );
                                  }
                                })}
                              </DroppableUnassignedContainer>
                            )}
                          </>
                        );
                      })()}
                    </DndProvider>
                  </div>
                )}

                {/* Pending files upload */}
                {pendingFiles.length > 0 && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: 'rgba(107, 140, 174, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(107, 140, 174, 0.3)',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
                      Pending Uploads ({pendingFiles.length})
                    </h4>
                    {pendingFiles.map((pendingFile, index) => (
                      <div key={index} style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '6px',
                        marginBottom: index < pendingFiles.length - 1 ? '8px' : '0'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '24px' }}>
                                {pendingFile.type === 'video' ? '🎬' : '📄'}
                              </span>
                              <div>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{pendingFile.file.name}</p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3b5' }}>
                                  {(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingFiles(prev => prev.filter((_, i) => i !== index));
                              }}
                              style={{
                                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', color: '#9ca3b5', display: 'block', marginBottom: '4px' }}>
                              Display Name:
                            </label>
                            <input
                              type="text"
                              value={pendingFile.name}
                              onChange={(e) => {
                                setPendingFiles(prev => prev.map((f, i) =>
                                  i === index ? { ...f, name: e.target.value } : f
                                ));
                              }}
                              className="text-input"
                              style={{ width: '100%', padding: '8px 12px' }}
                              placeholder={`Enter a name for this ${pendingFile.type === 'video' ? 'video' : 'material'}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden file inputs */}
                <input
                  id="pdf-upload-input"
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                  multiple
                />
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                  multiple
                />
              </div>

              <label className="input-label">Section</label>
              <select
                name="section_id"
                value={unitForm.section_id}
                onChange={(e) => setUnitForm({ ...unitForm, section_id: e.target.value })}
                className="text-input"
              >
                <option value="">No section (Unassigned)</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>

              <label className="input-label">Prerequisite Units</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  marginBottom: "16px"
                }}
              >
                {units.length === 0 || (editingUnit && units.length === 1) ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No other units available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {units
                      .filter(u => !editingUnit || u.unit_number !== editingUnit.unit_number)
                      .map((unit) => (
                        <label 
                          key={unit.id} 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 8,
                            padding: "8px",
                            backgroundColor: unitForm.prerequisite_units.includes(unit.unit_number) 
                              ? "rgba(107, 140, 174, 0.2)" 
                              : "transparent",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={unitForm.prerequisite_units.includes(unit.unit_number)}
                            onChange={() => togglePrerequisiteUnit(unit.unit_number)}
                          />
                          <span>{unit.title}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <label className="input-label">Prerequisite Tests</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  marginBottom: "16px"
                }}
              >
                {tests.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No tests available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tests.map((test) => (
                      <label 
                        key={test.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8,
                          padding: "8px",
                          backgroundColor: unitForm.prerequisite_tests.includes(test.id) 
                            ? "rgba(107, 140, 174, 0.2)" 
                            : "transparent",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={unitForm.prerequisite_tests.includes(test.id)}
                          onChange={() => togglePrerequisiteTest(test.id)}
                        />
                        <span>{test.test_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <input
                  type="checkbox"
                  name="is_mandatory"
                  checked={unitForm.is_mandatory}
                  onChange={(e) => setUnitForm({ ...unitForm, is_mandatory: e.target.checked })}
                />
                <span>Mandatory unit</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="primary-btn" disabled={submitting || uploadingFile}>
                  {uploadingFile
                    ? "Uploading..."
                    : submitting
                    ? "Saving..."
                    : editingUnit
                    ? "Update Unit"
                    : "Create Unit"}
                </button>
                {editingUnit && (
                  <>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ backgroundColor: '#6b8cae' }}
                      onClick={() => {
                        closeUnitForm();
                        handleDuplicateUnit(editingUnit);
                      }}
                      disabled={submitting || uploadingFile}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        closeUnitForm();
                        handleMoveUnit(editingUnit);
                      }}
                      disabled={submitting || uploadingFile}
                    >
                      Move to
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeUnitForm}
                  disabled={submitting || uploadingFile}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedChangesWarning && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: 0, marginBottom: 16 }}>Unsaved Changes</h3>
            <p style={{ margin: 0, marginBottom: 20, color: '#666' }}>
              You have unsaved changes in this unit. Are you sure you want to close without saving?
              All your changes will be lost.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowUnsavedChangesWarning(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ backgroundColor: '#dc2626' }}
                onClick={() => {
                  setShowUnsavedChangesWarning(false);
                  performCloseUnitForm();
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Upload Modal */}
      {showMaterialUploadModal && materialUploadType !== 'question' && (
        <div 
          className="modal-overlay" 
          onClick={uploadingFiles.length === 0 ? closeMaterialUploadModal : undefined}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div 
            className="modal-container" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: uploadPhase === 'reordering' ? '900px' : '600px',
              width: '90%',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              transition: 'max-width 0.3s ease',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h2 className="modal-title" style={{ color: '#f1f5f9' }}>
              {uploadPhase === 'uploading' && uploadingFiles.length > 0
                ? `Uploading ${uploadingFiles.filter(f => f.status === 'completed').length}/${uploadingFiles.length} files...`
                : uploadPhase === 'reordering' && uploadingFiles.length > 0
                ? `Arrange Your Materials (${uploadingFiles.length} files)`
                : materialUploadType === 'pdf' ? 'Upload PDF or Image' : 'Upload Video'}
            </h2>
            
            <div className="modal-form">
              {uploadingFiles.length > 0 && uploadPhase === 'uploading' ? (
                // Show upload progress
                <div style={{ 
                  marginBottom: '20px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  paddingRight: '8px'
                }}>
                  {uploadingFiles.map((file, index) => (
                    <div key={index} style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#9ca3b5', fontSize: '14px', fontWeight: 500 }}>
                          {file.name}
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          color: file.status === 'completed' ? '#10b981' : file.status === 'error' ? '#ef4444' : '#6b8cae',
                          fontWeight: 600
                        }}>
                          {file.status === 'completed' ? '✓ Complete' : file.status === 'error' ? '✗ Error' : `${file.progress}%`}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${file.progress}%`,
                          height: '100%',
                          backgroundColor: file.status === 'completed' ? '#10b981' : file.status === 'error' ? '#ef4444' : '#6b8cae',
                          transition: 'width 0.3s ease',
                          borderRadius: '3px'
                        }} />
                      </div>
                      
                      {file.error && (
                        <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0 0' }}>
                          {file.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : uploadingFiles.length > 0 && uploadPhase === 'reordering' ? (
                // Show preview grid for reordering
                <DndProvider backend={HTML5Backend}>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px' }}>
                    <p style={{ color: '#9ca3b5', marginBottom: '16px', fontSize: '14px' }}>
                      Drag and drop to reorder your materials. This will determine the display order.
                    </p>
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px',
                      maxHeight: '500px',
                      overflowY: 'auto',
                      paddingRight: '8px',
                      minHeight: '180px'
                    }}>
                      {uploadingFiles.map((file, index) => (
                        <DraggablePreviewItem
                          key={`preview-${index}-${file.name}`}
                          index={index}
                          item={file}
                          onMove={movePreviewItem}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handleConfirmUploadOrder}
                        className="primary-btn"
                        style={{ flex: 1 }}
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={closeMaterialUploadModal}
                        className="ghost-btn"
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </DndProvider>
              ) : uploadingFiles.length === 0 ? (
                // Show upload dropzone
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (materialUploadType === 'pdf') {
                      document.getElementById('pdf-upload-input')?.click();
                    } else {
                      document.getElementById('video-upload-input')?.click();
                    }
                  }}
                  style={{
                    border: `2px dashed ${isDragging ? 'rgba(107, 140, 174, 0.8)' : 'rgba(255, 255, 255, 0.3)'}`,
                    borderRadius: '12px',
                    padding: '60px 40px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? 'rgba(107, 140, 174, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                    {materialUploadType === 'pdf' ? '📄' : '🎬'}
                  </div>
                  <p style={{ color: '#9ca3b5', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>
                    {isDragging ? 'Drop files here' : 'Drag and drop your files here'}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: '8px 0' }}>
                    or click to browse (multiple files supported)
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '12px' }}>
                    {materialUploadType === 'pdf' 
                      ? 'PDF or images (JPEG, PNG, GIF, WebP, BMP, SVG) - max 10MB'
                      : 'MP4, MOV, AVI, MKV, WebM - max 100MB'}
                  </p>
                </div>
              ) : (
                // Debug: Show what state we're in
                <div style={{ padding: '20px', color: '#fff' }}>
                  <p>Debug Info:</p>
                  <p>Files: {uploadingFiles.length}</p>
                  <p>Phase: {uploadPhase}</p>
                  <p>Status: {uploadingFiles.map(f => f.status).join(', ')}</p>
                </div>
              )}

              {uploadingFiles.length === 0 && (
                <button
                  type="button"
                  onClick={closeMaterialUploadModal}
                  className="ghost-btn"
                  style={{ width: '100%' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Question Modal */}
      {showQuestionModal && (
        <div 
          className="modal-overlay" 
          onClick={closeQuestionModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div 
            className="modal-container" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h2 className="modal-title">
              {editingQuestionIndex !== null ? "Edit Review Question" : "Add Review Question"}
            </h2>
            
            <div className="modal-form">
              <label className="input-label">Question Text</label>
              <textarea
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Enter your question"
                style={{ width: '100%', padding: '12px', marginBottom: '16px' }}
              />

              <label className="input-label">Answer Options</label>
              <div style={{ marginBottom: '16px' }}>
                {questionForm.options.map((option, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={questionForm.correct_answer_index === index}
                      onChange={() => setQuestionForm({ ...questionForm, correct_answer_index: index })}
                      style={{ flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...questionForm.options];
                        newOptions[index] = e.target.value;
                        setQuestionForm({ ...questionForm, options: newOptions });
                      }}
                      className="text-input"
                      placeholder={`Option ${index + 1}`}
                      style={{ flex: 1, padding: '8px 12px' }}
                    />
                    {questionForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = questionForm.options.filter((_, i) => i !== index);
                          const newCorrectIndex = questionForm.correct_answer_index === index 
                            ? 0 
                            : questionForm.correct_answer_index > index 
                              ? questionForm.correct_answer_index - 1 
                              : questionForm.correct_answer_index;
                          setQuestionForm({ 
                            ...questionForm, 
                            options: newOptions,
                            correct_answer_index: newCorrectIndex
                          });
                        }}
                        style={{
                          backgroundColor: 'rgba(220, 38, 38, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {questionForm.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ""] })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: 'rgba(107, 140, 174, 0.1)',
                      border: '1px dashed rgba(107, 140, 174, 0.3)',
                      borderRadius: '4px',
                      color: '#6b8cae',
                      cursor: 'pointer',
                      fontSize: '12px',
                      marginTop: '8px'
                    }}
                  >
                    + Add Option
                  </button>
                )}
              </div>

              <label className="input-label">Explanation (Optional)</label>
              <textarea
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                className="text-input"
                rows={2}
                placeholder="Explain the correct answer"
                style={{ width: '100%', padding: '12px', marginBottom: '16px' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleQuestionSubmit}
                  className="primary-btn"
                >
                  {editingQuestionIndex !== null ? "Update Question" : "Add Question"}
                </button>
                <button
                  type="button"
                  onClick={closeQuestionModal}
                  className="ghost-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPartIndex !== null && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewPartIndex(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '900px',
              width: '90%',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h2 className="modal-title" style={{ color: '#f1f5f9', marginBottom: '16px' }}>
              Preview: {materialPartNames[previewPartIndex]}
            </h2>

            <div className="modal-form">
              {previewMaterials.length === 0 ? (
                <p style={{ color: '#9ca3b5', textAlign: 'center', padding: '40px' }}>
                  No materials in this part.
                </p>
              ) : (
                <DndProvider backend={HTML5Backend}>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px' }}>
                    <p style={{ color: '#9ca3b5', marginBottom: '16px', fontSize: '14px' }}>
                      Drag and drop to reorder materials in this part.
                    </p>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px',
                      maxHeight: '500px',
                      overflowY: 'auto',
                      paddingRight: '8px',
                      minHeight: '180px'
                    }}>
                      {previewMaterials.map((material, index) => (
                        <DraggablePreviewItem
                          key={`preview-${index}-${material.name}`}
                          index={index}
                          item={{
                            name: material.name,
                            type: material.type === 'question' ? 'pdf' : material.type, // Map question to pdf for display
                            previewUrl: material.url,
                            status: 'completed'
                          }}
                          onMove={movePreviewMaterial}
                        />
                      ))}
                    </div>
                  </div>
                </DndProvider>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSlideshow(true)}
                  className="primary-btn"
                  disabled={previewMaterials.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  ▶️ Play
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPartIndex(null)}
                  className="ghost-btn"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slideshow Modal */}
      {showSlideshow && previewPartIndex !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1400px',
              height: '95vh',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              overflow: 'auto',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '16px',
              backgroundColor: 'rgba(248, 250, 252, 0.95)',
              zIndex: 100,
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
              <button
                onClick={() => setShowSlideshow(false)}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <SlidePresentation
                unit={getSlideshowUnit()}
                materials={getSlideshowMaterials()}
                onComplete={handleSlideshowComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Test Form Modal */}
      {showTestForm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingTest ? "Edit Test" : "Create Test"}
              </h3>
              <button className="ghost-btn" onClick={closeTestForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleTestSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Test Name *</label>
              <input
                name="test_name"
                value={testForm.test_name}
                onChange={(e) => setTestForm({ ...testForm, test_name: e.target.value })}
                className="text-input"
                placeholder="Test name"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="test_description"
                value={testForm.test_description}
                onChange={(e) => setTestForm({ ...testForm, test_description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Test Type *</label>
                  <select
                    name="test_type"
                    value={testForm.test_type}
                    onChange={(e) => setTestForm({ ...testForm, test_type: e.target.value as any })}
                    className="text-input"
                    required
                  >
                    {TEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Passing Score *</label>
                  <input
                    name="passing_score"
                    type="number"
                    value={testForm.passing_score}
                    onChange={(e) => setTestForm({ ...testForm, passing_score: parseInt(e.target.value) })}
                    className="text-input"
                    placeholder="70"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              </div>

              <label className="input-label">Duration (minutes)</label>
              <input
                name="duration"
                type="number"
                value={testForm.duration}
                onChange={(e) => setTestForm({ ...testForm, duration: parseInt(e.target.value) || 60 })}
                className="text-input"
                placeholder="60"
                min="1"
              />

              <label className="input-label">Section</label>
              <select
                name="section_id"
                value={testForm.section_id}
                onChange={(e) => setTestForm({ ...testForm, section_id: e.target.value })}
                className="text-input"
              >
                <option value="">No section (Unassigned)</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>

              <label className="input-label">Required Units</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)"
                }}
              >
                {units.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No units available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {units.map((unit) => (
                      <label 
                        key={unit.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8,
                          padding: "8px",
                          backgroundColor: testForm.required_units.includes(unit.unit_number) 
                            ? "rgba(107, 140, 174, 0.2)" 
                            : "transparent",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={testForm.required_units.includes(unit.unit_number)}
                          onChange={() => toggleUnitSelection(unit.unit_number)}
                        />
                        <span>{unit.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="required_for_progression"
                    checked={testForm.required_for_progression}
                    onChange={(e) => setTestForm({ ...testForm, required_for_progression: e.target.checked })}
                  />
                  <span>Required for progression</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={testForm.is_active}
                    onChange={(e) => setTestForm({ ...testForm, is_active: e.target.checked })}
                  />
                  <span>Active test</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="needs_proctor"
                    checked={testForm.needs_proctor}
                    onChange={(e) => setTestForm({ 
                      ...testForm, 
                      needs_proctor: e.target.checked,
                      price_of_schedule: e.target.checked ? testForm.price_of_schedule : null
                    })}
                  />
                  <span>Needs proctor</span>
                </label>
              </div>

              {testForm.needs_proctor && (
                <div style={{ marginTop: 16 }}>
                  <label className="input-label">Price of Schedule (USD) *</label>
                  <div style={{ fontSize: '12px', color: '#9ca3b5', marginBottom: 4 }}>
                    Enter amount in dollars (e.g., 49.99). Maximum $500.00
                  </div>
                  <input
                    name="price_of_schedule"
                    type="number"
                    value={testForm.price_of_schedule !== null ? (testForm.price_of_schedule / 100).toFixed(2) : ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : Math.round(parseFloat(e.target.value) * 100);
                      setTestForm({ ...testForm, price_of_schedule: value });
                    }}
                    className="text-input"
                    placeholder="49.99"
                    min="0"
                    max="500"
                    step="0.01"
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingTest ? "Update Test" : "Create Test"}
                </button>
                {editingTest && (
                  <>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ backgroundColor: '#6b8cae' }}
                      onClick={() => {
                        closeTestForm();
                        handleDuplicateTest(editingTest);
                      }}
                      disabled={submitting}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        closeTestForm();
                        handleMoveTest(editingTest);
                      }}
                      disabled={submitting}
                    >
                      Move to
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeTestForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Questions Manager Modal */}
      {showQuestionsManager && managingTest && (
        managingTest.test_type === "multiple_choice" ? (
          <TestQuestionsManager
            testId={managingTest.id}
            testName={managingTest.test_name}
            onClose={() => {
              setShowQuestionsManager(false);
              setManagingTest(null);
            }}
          />
        ) : managingTest.test_type === "practical" ? (
          <PracticalTestCriteriaManager
            testId={managingTest.id}
            testName={managingTest.test_name}
            onClose={() => {
              setShowQuestionsManager(false);
              setManagingTest(null);
            }}
          />
        ) : null
      )}

      {/* Move To Modal */}
      {showMoveModal && movingItem && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Move {movingItem.type === 'unit' ? 'Unit' : 'Test'} to Another Course
              </h3>
              <button className="ghost-btn" onClick={closeMoveModal}>
                Close
              </button>
            </div>

            {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#9ca3b5", marginBottom: 12 }}>
                Moving: <strong>
                  {movingItem.type === 'unit' 
                    ? (movingItem.item as CourseUnit).title 
                    : (movingItem.item as CourseTest).test_name}
                </strong>
              </p>
              <p style={{ color: "#9ca3b5", fontSize: 14 }}>
                Note: The {movingItem.type} will be moved to the target course and its section assignment will be cleared.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Search for Course</label>
              <input
                type="text"
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                className="text-input"
                placeholder="Type to search courses..."
                style={{ marginBottom: 12 }}
              />

              <label className="input-label">Select Target Course *</label>
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                }}
              >
                {filteredCourses.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0, padding: "12px", textAlign: "center" }}>
                    {courseSearchQuery ? "No courses found matching your search" : "No other Buzz courses available"}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredCourses.map((course) => (
                      <label
                        key={course.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px",
                          backgroundColor: targetCourseId === course.id
                            ? "rgba(107, 140, 174, 0.3)"
                            : "rgba(255, 255, 255, 0.05)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (targetCourseId !== course.id) {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (targetCourseId !== course.id) {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="targetCourse"
                          checked={targetCourseId === course.id}
                          onChange={() => setTargetCourseId(course.id)}
                          style={{ flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>{course.title}</div>
                          <div style={{ fontSize: 12, color: "#9ca3b5" }}>ID: {course.id}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="primary-btn"
                onClick={handleConfirmMove}
                disabled={submitting || !targetCourseId}
              >
                {submitting ? "Moving..." : "Confirm Move"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={closeMoveModal}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Part Warning Modal */}
      {showRemovePartWarningModal && (
        <div
          className="modal-overlay"
          onClick={closeRemovePartWarningModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '90%',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 className="modal-title" style={{ marginBottom: '16px', color: '#ffffff' }}>
              Remove Part
            </h2>

            <div style={{ marginBottom: '24px', color: '#e2e8f0' }}>
              This part contains materials. What would you like to do?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                onClick={handleRemovePartKeepFiles}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#6b8cae',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Remove this part but keep files (files become unassigned materials)
              </button>
              <button
                type="button"
                onClick={handleRemovePartAndFiles}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Remove part and files
              </button>
              <button
                type="button"
                onClick={handleCancelRemovePart}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#6b8cae',
                  border: '1px solid #6b8cae',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Materials Modal */}
      {showDeleteSelectedModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteSelectedModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '90%',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 className="modal-title" style={{ marginBottom: '16px', color: '#ffffff' }}>
              Delete Selected Materials
            </h2>

            <div style={{ marginBottom: '24px', color: '#e2e8f0' }}>
              Are you sure you want to delete {selectedMaterials.size} selected material{selectedMaterials.size !== 1 ? 's' : ''}? This action cannot be undone.
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteSelectedModal(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#6b8cae',
                  border: '1px solid #6b8cae',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSelectedMaterials}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Part Modal */}
      {showMovePartModal && (
        <div
          className="modal-overlay"
          onClick={closeMovePartModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '90%',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 className="modal-title" style={{ marginBottom: '16px', color: '#ffffff' }}>
              Move Part to Another Unit
            </h2>

            <div style={{ marginBottom: '24px', color: '#e2e8f0' }}>
              Select the unit to move "{partToMove !== null ? materialPartNames[partToMove] : ''}" to:
            </div>

            <div style={{ marginBottom: '24px' }}>
              <select
                value={targetUnitForMove}
                onChange={(e) => setTargetUnitForMove(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Select a unit...</option>
                {units
                  .filter(unit => editingUnit && unit.id !== editingUnit.id) // Exclude current unit
                  .map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.title}
                    </option>
                  ))
                }
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeMovePartModal}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#6b8cae',
                  border: '1px solid #6b8cae',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={movePartToUnit}
                disabled={!targetUnitForMove || submitting}
                style={{
                  padding: '12px 16px',
                  backgroundColor: targetUnitForMove ? '#6b8cae' : '#475569',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: targetUnitForMove && !submitting ? 'pointer' : 'not-allowed',
                  fontSize: '14px'
                }}
              >
                {submitting ? 'Moving...' : 'Move Part'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
