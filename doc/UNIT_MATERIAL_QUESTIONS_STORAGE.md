# Unit Material Questions Storage Guide

## Overview

Multiple choice questions added through the "Add Material" button in the Edit Unit window are stored directly in the `course_units` table using a unified material system. Unlike test questions (stored in the separate `test_questions` table), these unit-level questions are embedded as JSON data URLs within the unit's material arrays.

## Database Storage

### Table: `course_units`

The questions are stored in three related JSONB columns:

```sql
ALTER TABLE public.course_units
ADD COLUMN IF NOT EXISTS material_urls jsonb NULL,
ADD COLUMN IF NOT EXISTS material_names jsonb NULL,
ADD COLUMN IF NOT EXISTS material_types jsonb NULL;
```

### Array Structure

All three arrays maintain matching indices:

- `material_urls[n]` - Contains the encoded question data URL
- `material_names[n]` - Contains the display name (e.g., "Q1: What is the capital of France?")
- `material_types[n]` - Contains the string `"question"`

### Example Database Entry

```json
{
  "material_urls": [
    "https://storage.supabase.co/bucket/materials/unit-123/pdf1.pdf",
    "data:application/json;base64,eyJxdWVzdGlvbl90ZXh0IjoiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/Iiwib3B0aW9ucyI6WyJQYXJpcyIsIkxvbmRvbiIsIkJlcmxpbiIsIk1hZHJpZCJdLCJjb3JyZWN0X2Fuc3dlcl9pbmRleCI6MCwiZXhwbGFuYXRpb24iOiJQYXJpcyBpcyB0aGUgY2FwaXRhbCBhbmQgbW9zdCBwb3B1bG91cyBjaXR5IGluIEZyYW5jZSJ9"
  ],
  "material_names": [
    "Unit Introduction.pdf",
    "Q1: What is the capital of France?"
  ],
  "material_types": [
    "pdf",
    "question"
  ]
}
```

## Data Structure

### TypeScript Interface

```typescript
type ReviewQuestion = {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
};
```

### Properties

- `question_text`: The question text displayed to the user
- `options`: Array of multiple choice options (strings)
- `correct_answer_index`: Zero-based index of the correct answer in the options array
- `explanation`: Optional explanation text shown after answering

## Encoding Process

### 1. JSON Serialization

```typescript
const question: ReviewQuestion = {
  question_text: "What is the capital of France?",
  options: ["Paris", "London", "Berlin", "Madrid"],
  correct_answer_index: 0,
  explanation: "Paris is the capital and most populous city in France"
};

const jsonString = JSON.stringify(question);
// Result: {"question_text":"What is the capital of France?","options":["Paris","London","Berlin","Madrid"],"correct_answer_index":0,"explanation":"Paris is the capital and most populous city in France"}
```

### 2. Base64 Encoding

```typescript
const base64String = btoa(jsonString);
// Result: eyJxdWVzdGlvbl90ZXh0IjoiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/Iiwib3B0aW9ucyI6WyJQYXJpcyIsIkxvbmRvbiIsIkJlcmxpbiIsIk1hZHJpZCJdLCJjb3JyZWN0X2Fuc3dlcl9pbmRleCI6MCwiZXhwbGFuYXRpb24iOiJQYXJpcyBpcyB0aGUgY2FwaXRhbCBhbmQgbW9zdCBwb3B1bG91cyBjaXR5IGluIEZyYW5jZSJ9
```

### 3. Data URL Creation

```typescript
const dataUrl = `data:application/json;base64,${base64String}`;
// Result: data:application/json;base64,eyJxdWVzdGlvbl90ZXh0IjoiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/Iiwib3B0aW9ucyI6WyJQYXJpcyIsIkxvbmRvbiIsIkJlcmxpbiIsIk1hZHJpZCJdLCJjb3JyZWN0X2Fuc3dlcl9pbmRleCI6MCwiZXhwbGFuYXRpb24iOiJQYXJpcyBpcyB0aGUgY2FwaXRhbCBhbmQgbW9zdCBwb3B1bG91cyBjaXR5IGluIEZyYW5jZSJ9
```

## Fetching Process

### Database Query

```sql
SELECT material_urls, material_names, material_types
FROM course_units
WHERE id = 'your-unit-id';
```

### TypeScript/JavaScript Fetch

```typescript
import { supabaseClient } from '../utility/supabaseClient';

const fetchUnitMaterials = async (unitId: string) => {
  const { data, error } = await supabaseClient
    .from('course_units')
    .select('material_urls, material_names, material_types')
    .eq('id', unitId)
    .single();

  if (error) throw error;
  return data;
};
```

## Decoding Process

### Complete Decode Function

```typescript
/**
 * Decodes a question from a data URL stored in material_urls
 * @param url - The data URL containing encoded question JSON
 * @returns The decoded ReviewQuestion object or null if invalid
 */
const getQuestionFromUrl = (url: string): ReviewQuestion | null => {
  try {
    // Check if it's a data URL with JSON content
    if (url.startsWith('data:application/json;base64,')) {
      // Extract the Base64 part
      const base64 = url.replace('data:application/json;base64,', '');

      // Decode Base64 to get JSON string
      const json = atob(base64);

      // Parse JSON to get the question object
      const question: ReviewQuestion = JSON.parse(json);

      return question;
    }
    return null;
  } catch (error) {
    console.error('Error decoding question from URL:', error);
    return null;
  }
};
```

### Step-by-Step Decoding

```typescript
// Example data URL
const dataUrl = "data:application/json;base64,eyJxdWVzdGlvbl90ZXh0IjoiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/Iiwib3B0aW9ucyI6WyJQYXJpcyIsIkxvbmRvbiIsIkJlcmxpbiIsIk1hZHJpZCJdLCJjb3JyZWN0X2Fuc3dlcl9pbmRleCI6MCwiZXhwbGFuYXRpb24iOiJQYXJpcyBpcyB0aGUgY2FwaXRhbCBhbmQgbW9zdCBwb3B1bG91cyBjaXR5IGluIEZyYW5jZSJ9";

// Step 1: Extract Base64 part
const base64 = dataUrl.replace('data:application/json;base64,', '');
// Result: eyJxdWVzdGlvbl90ZXh0IjoiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/Iiwib3B0aW9ucyI6WyJQYXJpcyIsIkxvbmRvbiIsIkJlcmxpbiIsIk1hZHJpZCJdLCJjb3JyZWN0X2Fuc3dlcl9pbmRleCI6MCwiZXhwbGFuYXRpb24iOiJQYXJpcyBpcyB0aGUgY2FwaXRhbCBhbmQgbW9zdCBwb3B1bG91cyBjaXR5IGluIEZyYW5jZSJ9

// Step 2: Decode Base64 to JSON string
const jsonString = atob(base64);
// Result: {"question_text":"What is the capital of France?","options":["Paris","London","Berlin","Madrid"],"correct_answer_index":0,"explanation":"Paris is the capital and most populous city in France"}

// Step 3: Parse JSON to object
const question: ReviewQuestion = JSON.parse(jsonString);
// Result:
// {
//   question_text: "What is the capital of France?",
//   options: ["Paris", "London", "Berlin", "Madrid"],
//   correct_answer_index: 0,
//   explanation: "Paris is the capital and most populous city in France"
// }
```

## Processing All Unit Materials

### Extract All Questions from a Unit

```typescript
/**
 * Extracts all questions from a unit's materials
 * @param unit - The course unit object
 * @returns Array of question objects with their indices
 */
const extractQuestionsFromUnit = (unit: CourseUnit): Array<{index: number, question: ReviewQuestion}> => {
  const questions: Array<{index: number, question: ReviewQuestion}> = [];

  if (!unit.material_urls || !unit.material_types) return questions;

  unit.material_urls.forEach((url, index) => {
    if (unit.material_types[index] === 'question') {
      const question = getQuestionFromUrl(url);
      if (question) {
        questions.push({ index, question });
      }
    }
  });

  return questions;
};
```

### Usage Example

```typescript
// Fetch unit data
const unitData = await fetchUnitMaterials('unit-123');

// Extract all questions
const questions = extractQuestionsFromUnit(unitData);

// Display questions
questions.forEach(({ index, question }) => {
  console.log(`Question ${index + 1}: ${question.question_text}`);
  console.log(`Correct answer: ${question.options[question.correct_answer_index]}`);
  if (question.explanation) {
    console.log(`Explanation: ${question.explanation}`);
  }
});
```

## Migration and Backward Compatibility

### Legacy Columns (Deprecated)

The system previously used separate columns for different material types:
- `pdf_url`, `pdf_names` (deprecated)
- `video_urls`, `video_names` (deprecated)
- `review_questions` (deprecated)

### Migration Notes

All legacy data has been consolidated into the unified `material_*` arrays. The comment in the code states:

```typescript
// video_urls, video_names, review_questions are deprecated - now stored in unified material_* arrays
```

## Security Considerations

1. **Data Validation**: Always validate question data when decoding to prevent malformed JSON
2. **Error Handling**: Wrap decode operations in try-catch blocks
3. **Type Safety**: Use TypeScript interfaces to ensure type safety
4. **Sanitization**: Sanitize question text and options before display to prevent XSS

## Performance Notes

1. **Storage Size**: Each question increases the JSONB column size
2. **Query Performance**: JSONB columns are efficient for reading but consider indexing if querying frequently
3. **Caching**: Consider caching decoded questions in memory for frequently accessed units

## Complete Working Example

```typescript
// Complete example of fetching and displaying unit questions

import { supabaseClient } from '../utility/supabaseClient';

interface CourseUnit {
  id: string;
  material_urls: string[] | null;
  material_names: string[] | null;
  material_types: string[] | null;
}

type ReviewQuestion = {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
};

const getQuestionFromUrl = (url: string): ReviewQuestion | null => {
  try {
    if (url.startsWith('data:application/json;base64,')) {
      const base64 = url.replace('data:application/json;base64,', '');
      const json = atob(base64);
      return JSON.parse(json);
    }
    return null;
  } catch {
    return null;
  }
};

const createQuestionDataUrl = (question: ReviewQuestion): string => {
  const json = JSON.stringify(question);
  const base64 = btoa(json);
  return `data:application/json;base64,${base64}`;
};

const fetchAndDisplayUnitQuestions = async (unitId: string) => {
  // Fetch unit data
  const { data: unit, error } = await supabaseClient
    .from('course_units')
    .select('material_urls, material_names, material_types')
    .eq('id', unitId)
    .single();

  if (error || !unit) {
    console.error('Error fetching unit:', error);
    return;
  }

  // Extract questions
  const questions: Array<{name: string, question: ReviewQuestion}> = [];

  if (unit.material_urls && unit.material_types && unit.material_names) {
    unit.material_urls.forEach((url, index) => {
      if (unit.material_types[index] === 'question') {
        const question = getQuestionFromUrl(url);
        if (question) {
          questions.push({
            name: unit.material_names[index],
            question
          });
        }
      }
    });
  }

  // Display questions
  questions.forEach(({ name, question }, index) => {
    console.log(`\n${name}`);
    console.log(`Question: ${question.question_text}`);
    console.log('Options:');
    question.options.forEach((option, optIndex) => {
      const marker = optIndex === question.correct_answer_index ? '✓' : '○';
      console.log(`  ${marker} ${option}`);
    });
    if (question.explanation) {
      console.log(`Explanation: ${question.explanation}`);
    }
  });

  return questions;
};

// Usage
fetchAndDisplayUnitQuestions('your-unit-id');
```