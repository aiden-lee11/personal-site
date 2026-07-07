   .text
   .globl go

go:
   # save callee-saved registers
   pushq %rbx
   pushq %rbp
   pushq %r12
   pushq %r13
   pushq %r14
   pushq %r15

   call _main

   # restore callee-saved registers and return
   popq %r15
   popq %r14
   popq %r13
   popq %r12
   popq %rbp
   popq %rbx
   retq


_fibonacci:
   movq %rdi, %rsi
_call_label_ciao_4:
   jmp _call_label_ciao_11
_call_label_ciao_5:
   movq $3, %rax
   retq
_call_label_ciao_6:
   movq %rax, %rcx
   movq $1, %rdi
   movq %rcx, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq %r8, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq %rdi, %rcx
   addq %rdx, %rcx
   movq %rcx, %rcx
   salq $1, %rcx
   movq %rcx, %rcx
   addq $1, %rcx
   movq %r8, %rax
   movq %rcx, %r8
   movq $1, %rdx
   movq %r9, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $3, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %r9
   addq %rdi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   jmp _call_label_ciao_7
_call_label_ciao_7:
   movq $1, %rdi
   movq %r9, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq %rsi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq %rdx, %rdi
   setle %dl
   movzbq %dl, %rdx
   movq %rdx, %rdx
   salq $1, %rdx
   movq %rdx, %rdx
   addq $1, %rdx
   movq $1, %rdi
   movq %rdx, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_6
   jmp _call_label_ciao_8
_call_label_ciao_8:
   movq %rcx, %rax
   retq
_call_label_ciao_9:
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq $1, %rcx
   movq $3, %rax
   movq $3, %r8
   movq $7, %r9
   movq $1, %rcx
   jmp _call_label_ciao_7
_call_label_ciao_10:
   movq $1, %rdi
   movq %rsi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq $5, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq %rdx, %rdi
   sete %dl
   movzbq %dl, %rdx
   movq %rdx, %rdx
   salq $1, %rdx
   movq %rdx, %rdx
   addq $1, %rdx
   movq $1, %rdi
   movq %rdx, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_5
   jmp _call_label_ciao_9
_call_label_ciao_11:
   movq $1, %rdx
   movq $1, %rdx
   movq %rsi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $3, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq %rdi, %rdx
   sete %dl
   movzbq %dl, %rdx
   movq %rdx, %rdx
   salq $1, %rdx
   movq %rdx, %rdx
   addq $1, %rdx
   movq $1, %rdi
   movq %rdx, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_5
   jmp _call_label_ciao_10


_main:
_call_label0:
   jmp _call_label2
_call_label1:
   retq
_call_label2:
   movq $1, %rdi
   movq $41, %rdi
   movq $_call_label3, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _fibonacci        # Call to @fibonacci
_call_label3:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   retq

