package com.vyaparsamraj.exception;

public class RateLimitException extends RuntimeException {
    public RateLimitException() { super("Too many requests — please try again later"); }
}
