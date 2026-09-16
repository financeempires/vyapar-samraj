package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Customer;
import com.vyaparsamraj.entity.CustomerLoan;
import com.vyaparsamraj.entity.CustomerPayment;
import com.vyaparsamraj.exception.ResourceNotFoundException;
import com.vyaparsamraj.repository.CustomerLoanRepository;
import com.vyaparsamraj.repository.CustomerPaymentRepository;
import com.vyaparsamraj.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerPaymentService {

    private final CustomerPaymentRepository paymentRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLoanRepository loanRepository;

    public List<CustomerPayment> getPayments(UUID userId, UUID customerId, UUID loanId) {
        customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        if (loanId != null) {
            return paymentRepository.findByCustomerIdAndLoanId(customerId, loanId);
        }
        return paymentRepository.findByCustomerIdOrderByCreatedAtAscIdAsc(customerId);
    }

    @Transactional
    public Map<String, Object> recordPayment(UUID userId, Map<String, Object> body) {
        String customerIdStr = parseString(body.get("customer_id"));
        if (customerIdStr == null) customerIdStr = parseString(body.get("customerId"));
        if (customerIdStr == null) throw new IllegalArgumentException("Customer ID is mandatory");

        UUID customerId = UUID.fromString(customerIdStr);
        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        BigDecimal amount = parseBigDecimal(body.get("amount"));
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be a positive number");
        }

        String rawMethod = parseString(body.get("payment_method"));
        if (rawMethod == null) rawMethod = parseString(body.get("paymentMethod"));
        String cleanMethod = "cash";
        if (rawMethod != null) {
            String m = rawMethod.trim().toLowerCase();
            if (m.equals("upi") || m.equals("account") || m.equals("cash")) {
                cleanMethod = m;
            }
        }

        String rawLoanId = parseString(body.get("loan_id"));
        if (rawLoanId == null) rawLoanId = parseString(body.get("loanId"));
        UUID targetLoanId = rawLoanId != null ? UUID.fromString(rawLoanId) : customerId;

        BigDecimal totalAmount;
        BigDecimal currentPaid;

        if (!targetLoanId.equals(customerId)) {
            CustomerLoan loan = loanRepository.findByIdAndUserId(targetLoanId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Additional loan record not found or access denied"));
            totalAmount = loan.getTotalAmount() != null ? loan.getTotalAmount() : BigDecimal.ZERO;
            currentPaid = paymentRepository.sumAmountByLoanId(targetLoanId);
        } else {
            totalAmount = customer.getTotalAmount() != null ? customer.getTotalAmount() : BigDecimal.ZERO;
            currentPaid = paymentRepository.sumAmountByCustomerIdMainLoan(customerId);
        }
        if (currentPaid == null) currentPaid = BigDecimal.ZERO;

        BigDecimal remainingBalance = totalAmount.subtract(currentPaid).max(BigDecimal.ZERO);
        if (remainingBalance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Loan balance is already fully settled (₹0 remaining)");
        }
        if (amount.compareTo(remainingBalance) > 0) {
            throw new IllegalArgumentException("Payment amount cannot exceed remaining balance of ₹" + remainingBalance);
        }

        LocalDate paymentDate = parseLocalDate(body.get("payment_date"));
        if (paymentDate == null) paymentDate = LocalDate.now();

        CustomerPayment payment = CustomerPayment.builder()
                .customerId(customerId)
                .loanId(targetLoanId)
                .amount(amount)
                .paymentMethod(cleanMethod)
                .paymentDate(paymentDate)
                .remarks(parseString(body.get("remarks")))
                .isEdited(false)
                .build();

        CustomerPayment saved = paymentRepository.save(payment);

        List<CustomerPayment> allPayments = paymentRepository.findByCustomerIdOrderByCreatedAtAscIdAsc(customerId);
        BigDecimal newTotalPaid = currentPaid.add(amount);
        BigDecimal newBalance = totalAmount.subtract(newTotalPaid).max(BigDecimal.ZERO);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("payment", saved);
        result.put("payments", allPayments);
        result.put("total_paid", newTotalPaid);
        result.put("balance", newBalance);
        result.put("payment_count", allPayments.size());
        return result;
    }

    @Transactional
    public Map<String, Object> updatePayment(UUID userId, Map<String, Object> body) {
        String paymentIdStr = parseString(body.get("payment_id"));
        if (paymentIdStr == null) paymentIdStr = parseString(body.get("paymentId"));
        if (paymentIdStr == null) paymentIdStr = parseString(body.get("id"));
        if (paymentIdStr == null) throw new IllegalArgumentException("Payment ID is mandatory");

        String customerIdStr = parseString(body.get("customer_id"));
        if (customerIdStr == null) customerIdStr = parseString(body.get("customerId"));
        if (customerIdStr == null) throw new IllegalArgumentException("Customer ID is mandatory");

        UUID paymentId = UUID.fromString(paymentIdStr);
        UUID customerId = UUID.fromString(customerIdStr);

        Customer customer = customerRepository.findByIdAndUserId(customerId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found or access denied"));

        CustomerPayment existingPayment = paymentRepository.findByIdAndCustomerId(paymentId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment record not found"));

        BigDecimal amount = parseBigDecimal(body.get("amount"));
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be a positive number");
        }

        String rawMethod = parseString(body.get("payment_method"));
        if (rawMethod == null) rawMethod = parseString(body.get("paymentMethod"));
        String cleanMethod = "cash";
        if (rawMethod != null) {
            String m = rawMethod.trim().toLowerCase();
            if (m.equals("upi") || m.equals("account") || m.equals("cash")) {
                cleanMethod = m;
            }
        }

        UUID targetLoanId = existingPayment.getLoanId() != null ? existingPayment.getLoanId() : customerId;
        BigDecimal totalAmount;
        BigDecimal otherPaid;

        if (!targetLoanId.equals(customerId)) {
            CustomerLoan loan = loanRepository.findByIdAndUserId(targetLoanId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Additional loan record not found or access denied"));
            totalAmount = loan.getTotalAmount() != null ? loan.getTotalAmount() : BigDecimal.ZERO;
            otherPaid = paymentRepository.sumAmountByLoanIdExcluding(targetLoanId, paymentId);
        } else {
            totalAmount = customer.getTotalAmount() != null ? customer.getTotalAmount() : BigDecimal.ZERO;
            otherPaid = paymentRepository.sumAmountByCustomerIdMainLoanExcluding(customerId, paymentId);
        }
        if (otherPaid == null) otherPaid = BigDecimal.ZERO;

        BigDecimal maxAllowed = totalAmount.subtract(otherPaid).max(BigDecimal.ZERO);
        if (amount.compareTo(maxAllowed) > 0) {
            throw new IllegalArgumentException("Payment amount cannot exceed remaining balance limit of ₹" + maxAllowed);
        }

        LocalDate paymentDate = parseLocalDate(body.get("payment_date"));
        if (paymentDate != null) existingPayment.setPaymentDate(paymentDate);

        if (body.containsKey("remarks")) {
            existingPayment.setRemarks(parseString(body.get("remarks")));
        }

        existingPayment.setAmount(amount);
        existingPayment.setPaymentMethod(cleanMethod);
        existingPayment.setIsEdited(true);

        CustomerPayment updated = paymentRepository.save(existingPayment);

        List<CustomerPayment> allPayments = paymentRepository.findByCustomerIdOrderByCreatedAtAscIdAsc(customerId);
        BigDecimal newTotalPaid = otherPaid.add(amount);
        BigDecimal newBalance = totalAmount.subtract(newTotalPaid).max(BigDecimal.ZERO);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("payment", updated);
        result.put("payments", allPayments);
        result.put("total_paid", newTotalPaid);
        result.put("balance", newBalance);
        result.put("payment_count", allPayments.size());
        return result;
    }

    private String parseString(Object val) {
        if (val == null) return null;
        String s = String.valueOf(val).trim();
        return s.isEmpty() ? null : s;
    }

    private BigDecimal parseBigDecimal(Object val) {
        if (val == null) return null;
        try {
            String s = String.valueOf(val).trim();
            if (s.isEmpty()) return null;
            return new BigDecimal(s);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate parseLocalDate(Object val) {
        if (val == null) return null;
        try {
            String s = String.valueOf(val).trim();
            if (s.isEmpty()) return null;
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
    }
}
