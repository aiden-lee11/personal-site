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


_main:
_call_label0:
   jmp _call_label4
_call_label1:
   retq
_call_label2:
   movq $7, %rdi
   call print # runtime system call
   retq
_call_label3:
   movq $3, %rdi
   call print # runtime system call
   jmp _call_label2
_call_label4:
   movq $1, %rdi
   movq $1, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq $1, %rdi
   je _call_label3
   jmp _call_label2

