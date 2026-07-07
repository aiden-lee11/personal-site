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


_checkMatrix:
   subq $48, %rsp # Allocate spills
   movq %rdi, %rdi
   movq %rdi, 8(%rsp)
   movq %rsi, %rdi
   movq %rdi, 16(%rsp)
_call_label_ciao__ciao_96:
   jmp _call_label_ciao__ciao_115
_call_label_ciao__ciao_97:
   movq 0(%rsp), %rdi
   movq %rdi, %rax
   addq $48, %rsp # Free stack locations
   retq
_call_label_ciao__ciao_98:
   movq $3, %rdi
   movq %rdi, 0(%rsp)
   jmp _call_label_ciao__ciao_97
_call_label_ciao__ciao_99:
   movq $1, %rdi
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rsi
   movq $3, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   addq %rsi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   salq $1, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   addq $1, %rdi
   movq %rdi, 24(%rsp)
   jmp _call_label_ciao__ciao_100
_call_label_ciao__ciao_100:
   movq $1, %rsi
   movq $1, %rsi
   movq 24(%rsp), %rdi
   movq %rdi, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $1, %rdi
   movq 32(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq %rdi, %rsi
   setl %sil
   movzbq %sil, %rsi
   movq %rsi, %rsi
   salq $1, %rsi
   movq %rsi, %rsi
   addq $1, %rsi
   movq $1, %rdi
   movq %rsi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq $1, %rdi
   je _call_label_ciao__ciao_101
   jmp _call_label_ciao__ciao_97
_call_label_ciao__ciao_101:
   movq $1, %rsi
   movq $1, %rsi
   jmp _call_label_ciao__ciao_102
_call_label_ciao__ciao_102:
   movq $1, %rdi
   movq $1, %rdx
   movq %rsi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   movq %rdi, %rdi
   salq $1, %rdi
   movq %rdi, %rdi
   addq $1, %rdi
   movq $1, %rdx
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq $1, %rdx
   je _call_label_ciao__ciao_103
   jmp _call_label_ciao__ciao_99
_call_label_ciao__ciao_103:
   movq $1, %rdi
   movq $1, %rdx
   movq $1, %rdi
   movq $1, %rcx
   movq 24(%rsp), %rdi
   movq %rdi, %rcx
   movq %rcx, %rcx
   sarq $1, %rcx
   movq $1, %rdi
   movq $1, %r8
   movq %rsi, %r8
   movq %r8, %r8
   sarq $1, %r8
   movq $221, %r9
   movq $1, %rdx
   movq $1, %rax
   movq $1, %r10
   movq 8(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao__ciao_114
   jmp _call_label_ciao__ciao_104
_call_label_ciao__ciao_104:
   movq $1, %rax
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %rdx
   addq $8, %rdx
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq %rdx, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdx
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rcx, %r10
   movq %r10, %r10
   salq $1, %r10
   movq %r10, %r10
   addq $1, %r10
   cmpq $0, %rcx
   setge %r11b
   movzbq %r11b, %r11
   cmpq $1, %r11
   je _call_label_ciao__ciao_105
   jmp _call_label_ciao__ciao_111
_call_label_ciao__ciao_105:
   cmpq %rdi, %rcx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao__ciao_106
   jmp _call_label_ciao__ciao_111
_call_label_ciao__ciao_106:
   movq $3, %rax
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %rdx
   addq $8, %rdx
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq %rdx, %rdi
   movq 0(%rdi), %r11
   movq %r11, %rdx
   movq %r11, %r11
   sarq $1, %r11
   movq %r8, %r10
   movq %r10, %r10
   salq $1, %r10
   movq %r10, %r10
   addq $1, %r10
   cmpq $0, %r8
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao__ciao_107
   jmp _call_label_ciao__ciao_111
_call_label_ciao__ciao_107:
   cmpq %r11, %r8
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao__ciao_108
   jmp _call_label_ciao__ciao_111
_call_label_ciao__ciao_108:
   jmp _call_label_ciao__ciao_109
_call_label_ciao__ciao_109:
   movq $0, %rdx
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %r9
   movq %r9, %r9
   imulq %rdi, %r9
   movq %rcx, %rdi
   imulq %r9, %rdi
   movq %rdx, %rdx
   addq %rdi, %rdx
   movq %rdx, %rdx
   addq %r8, %rdx
   movq %rdx, %rdx
   imulq $8, %rdx
   movq %rdx, %rdx
   addq $24, %rdx
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq %rdx, %rdi
   movq 0(%rdi), %rdi
   movq $1, %rdx
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq 16(%rsp), %rdi
   movq %rdi, %rdi
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
   je _call_label_ciao__ciao_98
   jmp _call_label_ciao__ciao_110
_call_label_ciao__ciao_110:
   movq $1, %rdi
   movq %rsi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq $3, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq %rdi, %rsi
   addq %rdx, %rsi
   movq %rsi, %rsi
   salq $1, %rsi
   movq %rsi, %rsi
   addq $1, %rsi
   jmp _call_label_ciao__ciao_102
_call_label_ciao__ciao_111:
   movq %r9, %rdi
   movq %rax, %rsi
   movq %rdx, %rdx
   movq %r10, %rcx
   call tensor_error # runtime system call
   jmp _call_label_ciao__ciao_109
_call_label_ciao__ciao_112:
   movq %r9, %rdi
   movq %rdx, %rsi
   movq %r10, %rdx
   call tuple_error # runtime system call
   jmp _call_label_ciao__ciao_111
_call_label_ciao__ciao_113:
   movq %r9, %rdi
   movq %rdx, %rsi
   movq %r10, %rdx
   call array_error # runtime system call
   jmp _call_label_ciao__ciao_112
_call_label_ciao__ciao_114:
   movq %r9, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label_ciao__ciao_113
_call_label_ciao__ciao_115:
   movq $1, %rdi
   movq %rdi, 32(%rsp)
   movq $1, %rdi
   movq %rdi, 40(%rsp)
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %rsi
   addq $8, %rsi
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, 32(%rsp)
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %rsi
   addq $8, %rsi
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, 40(%rsp)
   movq $1, %rdi
   movq %rdi, 24(%rsp)
   movq $1, %rdi
   movq %rdi, 0(%rsp)
   movq $1, %rdi
   movq %rdi, 0(%rsp)
   movq $1, %rdi
   movq %rdi, 24(%rsp)
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 16(%rsp), %rdi
   movq %rdi, %rdi
   call print # runtime system call
   jmp _call_label_ciao__ciao_100


_initMatrix:
   subq $48, %rsp # Allocate spills
   movq %rdi, %rdi
   movq %rdi, 40(%rsp)
   movq %rsi, %rdi
   movq %rdi, 32(%rsp)
_call_label_ciao_77:
   jmp _call_label_ciao_95
_call_label_ciao_78:
   addq $48, %rsp # Free stack locations
   retq
_call_label_ciao_79:
   addq $48, %rsp # Free stack locations
   retq
_call_label_ciao_80:
   movq $1, %rdi
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq $3, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   addq %rdx, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   salq $1, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 24(%rsp)
   movq 24(%rsp), %rdi
   addq $1, %rdi
   movq %rdi, 24(%rsp)
   jmp _call_label_ciao_81
_call_label_ciao_81:
   movq $1, %rdi
   movq $1, %rdx
   movq 24(%rsp), %rdi
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq 16(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   movq %rdi, %rdi
   salq $1, %rdi
   movq %rdi, %rdi
   addq $1, %rdi
   movq $1, %rdx
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq $1, %rdx
   je _call_label_ciao_82
   jmp _call_label_ciao_79
_call_label_ciao_82:
   movq $1, %rdi
   movq %rdi, 8(%rsp)
   movq $1, %rdi
   movq %rdi, 8(%rsp)
   jmp _call_label_ciao_83
_call_label_ciao_83:
   movq $1, %rdi
   movq $1, %rdi
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq %rsi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq %rdx, %rdi
   setl %dil
   movzbq %dil, %rdi
   movq %rdi, %rdi
   salq $1, %rdi
   movq %rdi, %rdi
   addq $1, %rdi
   movq $1, %rdx
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   cmpq $1, %rdx
   je _call_label_ciao_84
   jmp _call_label_ciao_80
_call_label_ciao_84:
   movq $1, %rdi
   movq $1, %rdx
   movq 24(%rsp), %rdi
   movq %rdi, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $1, %rdi
   movq %rdi, 0(%rsp)
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 0(%rsp)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 0(%rsp)
   movq 0(%rsp), %rdi
   sarq $1, %rdi
   movq %rdi, 0(%rsp)
   movq $137, %rcx
   movq $1, %r9
   movq $1, %r8
   movq $1, %r10
   movq 40(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_94
   jmp _call_label_ciao_85
_call_label_ciao_85:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %r9
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %r10
   movq %r10, %r10
   salq $1, %r10
   movq %r10, %r10
   addq $1, %r10
   cmpq $0, %rdx
   setge %r11b
   movzbq %r11b, %r11
   cmpq $1, %r11
   je _call_label_ciao_86
   jmp _call_label_ciao_91
_call_label_ciao_86:
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_87
   jmp _call_label_ciao_91
_call_label_ciao_87:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r11
   movq %r11, %r9
   movq %r11, %r11
   sarq $1, %r11
   movq 0(%rsp), %rdi
   movq %rdi, %r10
   movq %r10, %r10
   salq $1, %r10
   movq %r10, %r10
   addq $1, %r10
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_88
   jmp _call_label_ciao_91
_call_label_ciao_88:
   movq 0(%rsp), %rdi
   cmpq %r11, %rdi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label_ciao_89
   jmp _call_label_ciao_91
_call_label_ciao_89:
   jmp _call_label_ciao_90
_call_label_ciao_90:
   movq $0, %rcx
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %r8
   movq %r8, %r8
   imulq %rdi, %r8
   movq %rdx, %rdi
   imulq %r8, %rdi
   movq %rcx, %rcx
   addq %rdi, %rcx
   movq %rcx, %rcx
   movq 0(%rsp), %rdi
   addq %rdi, %rcx
   movq %rcx, %rdi
   imulq $8, %rdi
   movq %rdi, %rdi
   addq $24, %rdi
   movq 40(%rsp), %rdx
   movq %rdx, %rdx
   addq %rdi, %rdx
   movq 32(%rsp), %rdi
   movq %rdi, 0(%rdx)
   movq $1, %rdi
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rdx
   movq $3, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq %rdi, %rdi
   movq %rdi, 8(%rsp)
   movq 8(%rsp), %rdi
   addq %rdx, %rdi
   movq %rdi, 8(%rsp)
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 8(%rsp)
   movq 8(%rsp), %rdi
   salq $1, %rdi
   movq %rdi, 8(%rsp)
   movq 8(%rsp), %rdi
   movq %rdi, %rdi
   movq %rdi, 8(%rsp)
   movq 8(%rsp), %rdi
   addq $1, %rdi
   movq %rdi, 8(%rsp)
   jmp _call_label_ciao_83
_call_label_ciao_91:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %r9, %rdx
   movq %r10, %rcx
   call tensor_error # runtime system call
   jmp _call_label_ciao_90
_call_label_ciao_92:
   movq %rcx, %rdi
   movq %r9, %rsi
   movq %r10, %rdx
   call tuple_error # runtime system call
   jmp _call_label_ciao_91
_call_label_ciao_93:
   movq %rcx, %rdi
   movq %r9, %rsi
   movq %r10, %rdx
   call array_error # runtime system call
   jmp _call_label_ciao_92
_call_label_ciao_94:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label_ciao_93
_call_label_ciao_95:
   movq $1, %rdi
   movq %rdi, 16(%rsp)
   movq $1, %rsi
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %rsi
   addq $8, %rsi
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, 16(%rsp)
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %rsi
   addq $8, %rsi
   movq 40(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 0(%rdi), %rsi
   movq $1, %rdi
   movq %rdi, 24(%rsp)
   movq $1, %rdi
   movq %rdi, 24(%rsp)
   jmp _call_label_ciao_81


_main:
   subq $16, %rsp # Allocate spills
_call_label0:
   jmp _call_label62
_call_label1:
   addq $16, %rsp # Free stack locations
   retq
_call_label2:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rdx, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rsi, %r8
   movq %r8, %rsi
   imulq $8, %rsi
   movq %rsi, %rsi
   addq $24, %rsi
   movq 0(%rsp), %rdi
   movq %rdi, %rdx
   addq %rsi, %rdx
   movq 8(%rsp), %rdi
   movq %rdi, 0(%rdx)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label63, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label63:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   addq $16, %rsp # Free stack locations
   retq
_call_label3:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %rax, %rdx
   movq %r9, %rcx
   call tensor_error # runtime system call
   jmp _call_label2
_call_label4:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call tuple_error # runtime system call
   jmp _call_label3
_call_label5:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call array_error # runtime system call
   jmp _call_label4
_call_label6:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label5
_call_label7:
   jmp _call_label2
_call_label8:
   cmpq %r10, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label7
   jmp _call_label3
_call_label9:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r10
   movq %r10, %rax
   movq %r10, %r10
   sarq $1, %r10
   movq %rsi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rsi
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label8
   jmp _call_label3
_call_label10:
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label9
   jmp _call_label3
_call_label11:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rdx
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label10
   jmp _call_label3
_call_label12:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rsi, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rdx, %r8
   movq %r8, %rdx
   imulq $8, %rdx
   movq %rdx, %rdx
   addq $24, %rdx
   movq 0(%rsp), %rdi
   movq %rdi, %rsi
   addq %rdx, %rsi
   movq 8(%rsp), %rdi
   movq %rdi, 0(%rsi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label64, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label64:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label65, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label65:
   movq $1, %rdi
   movq $1, %rdx
   movq $7, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $1, %rsi
   movq $7, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $77, %rcx
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label6
   jmp _call_label11
_call_label13:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %rax, %rdx
   movq %r9, %rcx
   call tensor_error # runtime system call
   jmp _call_label12
_call_label14:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call tuple_error # runtime system call
   jmp _call_label13
_call_label15:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call array_error # runtime system call
   jmp _call_label14
_call_label16:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label15
_call_label17:
   jmp _call_label12
_call_label18:
   cmpq %r10, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label17
   jmp _call_label13
_call_label19:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r10
   movq %r10, %rax
   movq %r10, %r10
   sarq $1, %r10
   movq %rdx, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rdx
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label18
   jmp _call_label13
_call_label20:
   cmpq %rdi, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label19
   jmp _call_label13
_call_label21:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rsi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rsi
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label20
   jmp _call_label13
_call_label22:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rsi, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rdx, %r8
   movq %r8, %rdx
   imulq $8, %rdx
   movq %rdx, %rdx
   addq $24, %rdx
   movq 0(%rsp), %rdi
   movq %rdi, %rsi
   addq %rdx, %rsi
   movq 8(%rsp), %rdi
   movq %rdi, 0(%rsi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label66, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label66:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label67, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label67:
   movq $1, %rdi
   movq $1, %rsi
   movq $7, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $1, %rdi
   movq $1, %rdx
   movq $3, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $67, %rcx
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label16
   jmp _call_label21
_call_label23:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %rax, %rdx
   movq %r9, %rcx
   call tensor_error # runtime system call
   jmp _call_label22
_call_label24:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call tuple_error # runtime system call
   jmp _call_label23
_call_label25:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call array_error # runtime system call
   jmp _call_label24
_call_label26:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label25
_call_label27:
   jmp _call_label22
_call_label28:
   cmpq %r10, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label27
   jmp _call_label23
_call_label29:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r10
   movq %r10, %rax
   movq %r10, %r10
   sarq $1, %r10
   movq %rdx, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rdx
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label28
   jmp _call_label23
_call_label30:
   cmpq %rdi, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label29
   jmp _call_label23
_call_label31:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rsi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rsi
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label30
   jmp _call_label23
_call_label32:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rdx, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rsi, %r8
   movq %r8, %rsi
   imulq $8, %rsi
   movq %rsi, %rsi
   addq $24, %rsi
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, 0(%rdi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label68, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label68:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label69, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label69:
   movq $1, %rdi
   movq $1, %rsi
   movq $7, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $1, %rdi
   movq $1, %rdx
   movq $1, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $57, %rcx
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label26
   jmp _call_label31
_call_label33:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %r9, %rdx
   movq %rax, %rcx
   call tensor_error # runtime system call
   jmp _call_label32
_call_label34:
   movq %rcx, %rdi
   movq %r9, %rsi
   movq %rax, %rdx
   call tuple_error # runtime system call
   jmp _call_label33
_call_label35:
   movq %rcx, %rdi
   movq %r9, %rsi
   movq %rax, %rdx
   call array_error # runtime system call
   jmp _call_label34
_call_label36:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label35
_call_label37:
   jmp _call_label32
_call_label38:
   cmpq %r10, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label37
   jmp _call_label33
_call_label39:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r10
   movq %r10, %r9
   movq %r10, %r10
   sarq $1, %r10
   movq %rsi, %rax
   movq %rax, %rax
   salq $1, %rax
   movq %rax, %rax
   addq $1, %rax
   cmpq $0, %rsi
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label38
   jmp _call_label33
_call_label40:
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label39
   jmp _call_label33
_call_label41:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %r9
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %rax
   movq %rax, %rax
   salq $1, %rax
   movq %rax, %rax
   addq $1, %rax
   cmpq $0, %rdx
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label40
   jmp _call_label33
_call_label42:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rdx, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rsi, %r8
   movq %r8, %rdx
   imulq $8, %rdx
   movq %rdx, %rdx
   addq $24, %rdx
   movq 0(%rsp), %rdi
   movq %rdi, %rsi
   addq %rdx, %rsi
   movq 8(%rsp), %rdi
   movq %rdi, 0(%rsi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label70, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label70:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label71, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label71:
   movq $1, %rdi
   movq $1, %rdx
   movq $3, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $1, %rsi
   movq $1, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $47, %rcx
   movq $1, %r9
   movq $1, %r8
   movq $1, %rax
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label36
   jmp _call_label41
_call_label43:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %rax, %rdx
   movq %r9, %rcx
   call tensor_error # runtime system call
   jmp _call_label42
_call_label44:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call tuple_error # runtime system call
   jmp _call_label43
_call_label45:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call array_error # runtime system call
   jmp _call_label44
_call_label46:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label45
_call_label47:
   jmp _call_label42
_call_label48:
   cmpq %rdi, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label47
   jmp _call_label43
_call_label49:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rsi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rsi
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label48
   jmp _call_label43
_call_label50:
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label49
   jmp _call_label43
_call_label51:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rdx
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label50
   jmp _call_label43
_call_label52:
   movq $0, %r8
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rdi
   sarq $1, %rdi
   movq $1, %rcx
   movq %rcx, %rcx
   imulq %rdi, %rcx
   movq %rsi, %rdi
   imulq %rcx, %rdi
   movq %r8, %r8
   addq %rdi, %r8
   movq %r8, %r8
   addq %rdx, %r8
   movq %r8, %rsi
   imulq $8, %rsi
   movq %rsi, %rsi
   addq $24, %rsi
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %rsi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, 0(%rdi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label72, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label72:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label73, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label73:
   movq $1, %rdi
   movq $1, %rdx
   movq $1, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $1, %rdi
   movq $1, %rsi
   movq $3, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $37, %rcx
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label46
   jmp _call_label51
_call_label53:
   movq %rcx, %rdi
   movq %r8, %rsi
   movq %rax, %rdx
   movq %r9, %rcx
   call tensor_error # runtime system call
   jmp _call_label52
_call_label54:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call tuple_error # runtime system call
   jmp _call_label53
_call_label55:
   movq %rcx, %rdi
   movq %rax, %rsi
   movq %r9, %rdx
   call array_error # runtime system call
   jmp _call_label54
_call_label56:
   movq %rcx, %rdi
   call array_tensor_error_null # runtime system call
   jmp _call_label55
_call_label57:
   jmp _call_label52
_call_label58:
   cmpq %rdi, %rdx
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label57
   jmp _call_label53
_call_label59:
   movq $3, %r8
   movq $1, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %rdi
   movq %rdi, %rax
   movq %rdi, %rdi
   sarq $1, %rdi
   movq %rdx, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rdx
   setge %r10b
   movzbq %r10b, %r10
   cmpq $1, %r10
   je _call_label58
   jmp _call_label53
_call_label60:
   cmpq %r10, %rsi
   setl %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label59
   jmp _call_label53
_call_label61:
   movq $1, %r8
   movq $0, %rdi
   imulq $8, %rdi
   movq %rdi, %r9
   addq $8, %r9
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq %r9, %rdi
   movq 0(%rdi), %r10
   movq %r10, %rax
   movq %r10, %r10
   sarq $1, %r10
   movq %rsi, %r9
   movq %r9, %r9
   salq $1, %r9
   movq %r9, %r9
   addq $1, %r9
   cmpq $0, %rsi
   setge %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label60
   jmp _call_label53
_call_label62:
   movq $0, %rdi
   movq %rdi, 0(%rsp)
   movq $1, %rdi
   movq $1, %rdi
   movq %rdi, 8(%rsp)
   movq $43, %rdi
   movq %rdi, 8(%rsp)
   movq $9, %rdi
   sarq $1, %rdi
   movq %rdi, %rdi
   movq $9, %rsi
   sarq $1, %rsi
   movq %rdi, %rdi
   imulq %rsi, %rdi
   movq %rdi, %rdi
   salq $1, %rdi
   movq %rdi, %rdi
   addq $1, %rdi
   movq %rdi, %rdi
   addq $4, %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   call allocate # runtime system call
   movq %rax, %rdi
   movq %rdi, 0(%rsp)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $8, %rdi
   movq $9, 0(%rdi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   addq $16, %rdi
   movq $9, 0(%rdi)
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label74, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label74:
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq 8(%rsp), %rsi
   movq %rsi, %rsi
   movq $_call_label75, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _checkMatrix        # Call to @checkMatrix
_call_label75:
   movq %rax, %rdi
   movq %rdi, %rdi
   call print # runtime system call
   movq 0(%rsp), %rdi
   movq %rdi, %rdi
   movq $1, %rsi
   movq $_call_label76, -8(%rsp)
   subq $8, %rsp      # Allocate extra arguments on the stack as well as the return address 
   jmp _initMatrix        # Call to @initMatrix
_call_label76:
   movq $1, %rdi
   movq $1, %rsi
   movq $1, %rsi
   movq %rsi, %rsi
   sarq $1, %rsi
   movq $1, %rdi
   movq $1, %rdx
   movq $1, %rdx
   movq %rdx, %rdx
   sarq $1, %rdx
   movq $27, %rcx
   movq $1, %rax
   movq $1, %r8
   movq $1, %r9
   movq 0(%rsp), %rdi
   cmpq $0, %rdi
   sete %dil
   movzbq %dil, %rdi
   cmpq $1, %rdi
   je _call_label56
   jmp _call_label61

