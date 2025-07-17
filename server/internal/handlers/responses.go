package handlers

type ErrorResponse struct {
	Message string `json:"error"`
}

func Error(message string) ErrorResponse {
	return ErrorResponse{Message: message}
}
