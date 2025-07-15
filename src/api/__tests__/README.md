# API Testing Strategy

This directory contains comprehensive tests for the API layer of the application. The testing strategy follows a **hybrid approach** that separates concerns while maintaining testability.

## Architecture Overview

### 1. **Pure API Client** (`apiClient.ts`)

- Extracted pure functions from React Query hooks
- No React Query dependencies
- Easy to test independently
- Handles all HTTP requests and error handling

### 2. **React Query Hooks** (`Api.ts`)

- Thin wrappers around API client functions
- Handle caching, loading states, and React Query features
- Tested with mocked API client

### 3. **Mock Service Worker (MSW)**

- Intercepts HTTP requests in tests
- Provides realistic API responses
- No need to mock `fetch` manually

## Testing Strategy

### **Unit Tests for API Client**

- Test each API function independently
- Verify correct HTTP methods, endpoints, and request bodies
- Test error handling and response parsing
- Type checking for return values

### **Unit Tests for React Query Hooks**

- Test hooks with mocked API client
- Verify correct query keys and configurations
- Test loading, success, and error states
- Ensure proper data transformation

### **Integration Tests**

- Test full API flow with MSW
- Verify end-to-end request/response cycles
- Test real HTTP requests with mocked responses

## Test Files Structure

```
src/api/__tests__/
├── setup.ts                    # MSW setup for tests
├── apiClient.test.ts           # Tests for pure API functions
├── Api.test.tsx               # Tests for React Query hooks
└── mocks/
    ├── server.ts              # MSW server setup
    ├── browser.ts             # MSW browser setup
    └── handlers.ts            # API response mocks
```

## Running Tests

```bash
# Run all API tests
npm test src/api/__tests__/

# Run specific test file
npm test src/api/__tests__/apiClient.test.ts

# Run with coverage
npm test -- --coverage
```

## Test Coverage

### API Client Tests

- ✅ All GET endpoints (daily prompt, user data, submissions, activity)
- ✅ All POST endpoints (auth, comments, reactions, submissions)
- ✅ All PUT endpoints (user updates)
- ✅ Error handling for network failures
- ✅ Type checking for all responses
- ✅ Request body validation

### React Query Hook Tests

- ✅ All query hooks (useGetDailyPrompt, useGetMe, etc.)
- ✅ All mutation hooks (useCreateUser, useAddComment, etc.)
- ✅ Loading states and error handling
- ✅ Proper query key management
- ✅ Data transformation and caching

## Benefits of This Approach

1. **Separation of Concerns**: Pure API functions are testable without React Query
2. **Type Safety**: Full TypeScript support with type checking in tests
3. **Realistic Testing**: MSW provides realistic HTTP request/response cycles
4. **Maintainability**: Easy to update tests when API changes
5. **Performance**: Fast unit tests with minimal dependencies

## Adding New API Endpoints

1. **Add to `apiClient.ts`**:

   ```typescript
   export const apiClient = {
     // ... existing functions
     newEndpoint: async (data: NewEndpointData) => {
       const response = await fetchAPI('POST', '/new-endpoint', {
         body: JSON.stringify(data),
       });
       if (!response.ok) {
         throw new Error(`Error: ${response.statusText}`);
       }
       return response.json();
     },
   };
   ```

2. **Add to `Api.ts`**:

   ```typescript
   export function useNewEndpoint() {
     return useMutation({
       mutationFn: apiClient.newEndpoint,
     });
   }
   ```

3. **Add to `handlers.ts`**:

   ```typescript
   http.post(`${baseUrl}/new-endpoint`, async ({ request }) => {
     const body = await request.json() as NewEndpointData;
     return HttpResponse.json({ success: true });
   }),
   ```

4. **Add tests**:
   - Unit test in `apiClient.test.ts`
   - Hook test in `Api.test.tsx`

## Best Practices

1. **Always test both success and error cases**
2. **Verify type safety in tests**
3. **Use realistic mock data**
4. **Test edge cases (empty responses, malformed data)**
5. **Keep tests focused and isolated**
6. **Use descriptive test names**

## Troubleshooting

### Common Issues

1. **MSW not intercepting requests**: Ensure setup is imported in test files
2. **Type errors**: Check that mock data matches TypeScript interfaces
3. **Async test failures**: Use `waitFor` for React Query state changes
4. **Network errors**: Verify MSW handlers are properly configured

### Debug Tips

- Use `console.log` in MSW handlers to debug request/response
- Check browser network tab to see actual requests
- Verify query keys match between tests and implementation
