class ApiError extends Error {
  constructor(
    statusCode,
    message = "Some thing went wrong !",
    errors = [],
    stack = ""
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.error = errors;
    this.success = false;
  }
}

export { ApiError };
